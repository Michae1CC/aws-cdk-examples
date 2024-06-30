#!/usr/bin/env python3

__author__ = "Michael Ciccotosto-Camp"
__version__ = ""

import io
import os
import contextlib
import json
import logging
import time
from typing import cast, Generator, Final, TypedDict

import boto3

from PIL import Image

SQS_URL: Final[str] = os.environ.get("SQS_URL") or ""
ICON_SIZE: Final[int] = int(os.environ.get("ICON_SIZE") or 0)
ICONS_BUCKET_NAME: Final[str] = os.environ.get("ICONS_BUCKET_NAME") or ""

S3_CLIENT: Final = boto3.client("s3")
SQS_CLIENT: Final = boto3.client("sqs")

logging.basicConfig(level=logging.INFO)
logger: logging.Logger = logging.getLogger()


class SqsMessage(TypedDict):
    Body: str
    MD5OfBody: str
    MessageId: str
    ReceiptHandle: str


@contextlib.contextmanager
def next_icon_paths() -> Generator[list[str], None, None]:

    sqs_response: dict = SQS_CLIENT.receive_message(
        QueueUrl=SQS_URL,
        MaxNumberOfMessages=5,
        # We can return all of the attributes by specifying All
        MessageAttributeNames=["All"],
        # Assuming each item takes a maximum time of 15 seconds to complete and
        # the maximum number of messages we can receive in any one request is 5,
        # then 5 * 15 is the maximum amount of time we should spend on this
        # request before making the items visible again due to an internal problem
        VisibilityTimeout=5 * 15,
        WaitTimeSeconds=5,
    )

    object_keys: list[str] = []
    messages = cast(list[SqsMessage], sqs_response.get("Messages", []))

    for message in messages:
        records = json.loads(json.loads(message["Body"])["Message"])["Records"]
        for record in records:
            object_key: str = record["s3"]["object"]["key"]
            object_keys.append(object_key)

    yield object_keys

    if messages:
        SQS_CLIENT.delete_message_batch(
            QueueUrl=SQS_URL,
            Entries=[
                {"Id": message["MessageId"], "ReceiptHandle": message["ReceiptHandle"]}
                for message in messages
            ],
        )


def get_resized_object_key(object_key: str, size: int) -> str:
    _, suffix = object_key.split("/", maxsplit=1)
    return "".join([f"icons-size-{size}", "/", suffix])


def main() -> None:
    if not SQS_URL:
        logger.error("No sqs url set in environment")

    if not ICONS_BUCKET_NAME:
        logger.error("No bucket arn set in environment")

    if not ICON_SIZE:
        logger.error("No icon size set in environment")

    logger.info("Starting to process icons")

    # Poll the sqs queue indefinitely
    while True:

        with next_icon_paths() as object_keys:
            logger.info("Got the following icons to process")
            logger.info(json.dumps(object_keys))

            for object_key in object_keys:
                # Get the new icon from s3, resize then put the resized icon
                # back into s3 under a different object key
                s3_response: dict = S3_CLIENT.get_object(
                    Bucket=ICONS_BUCKET_NAME, Key=object_key
                )
                image_data: bytes = s3_response["Body"].read()
                image = Image.open(io.BytesIO(image_data))
                image.thumbnail((ICON_SIZE, ICON_SIZE), Image.Resampling.LANCZOS)
                save_bytes_array = io.BytesIO()
                image.save(save_bytes_array, format="png")
                S3_CLIENT.put_object(
                    Body=save_bytes_array.getvalue(),
                    Bucket=ICONS_BUCKET_NAME,
                    Key=get_resized_object_key(object_key, ICON_SIZE),
                )

                # Artificially inflate the time it takes to process an image
                time.sleep(5)

        logger.info("Finished processing icons")

        get_queue_attributes_response = SQS_CLIENT.get_queue_attributes(
            QueueUrl=SQS_URL, AttributeNames=["ApproximateNumberOfMessages"]
        )
        approximate_number_of_messages_visible = int(
            get_queue_attributes_response["Attributes"]["ApproximateNumberOfMessages"]
        )

        if approximate_number_of_messages_visible > 0:
            continue
        else:
            sleep_time_seconds = 10
            time.sleep(sleep_time_seconds)


main()
