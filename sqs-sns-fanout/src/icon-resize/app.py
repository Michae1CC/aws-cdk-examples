#!/usr/bin/env python3

__author__ = "Michael Ciccotosto-Camp"
__version__ = ""

import os
import contextlib
import json
import logging
from typing import cast, Generator, Final, TypedDict

import boto3

SQS_URL: Final[str] = os.environ.get("SQS_URL") or ""
ICONS_BUCKET_ARN: Final[str] = os.environ.get("ICONS_BUCKET_ARN") or ""

SQS_CLIENT: Final = boto3.client("sqs")

logging.basicConfig(level=logging.INFO)
logger: logging.Logger = logging.getLogger()


class SqsMessage(TypedDict):
    Body: str
    MD5OfBody: str
    MessageId: str
    ReceiptHandle: str


@contextlib.contextmanager
def next_icon_paths() -> Generator[list[SqsMessage], None, None]:

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
        WaitTimeSeconds=0,
    )
    messages = cast(list[SqsMessage], sqs_response.get("Messages", []))

    yield messages

    if messages:
        SQS_CLIENT.delete_message_batch(
            QueueUrl=SQS_URL,
            Entries=[
                {"Id": message["MessageId"], "ReceiptHandle": message["ReceiptHandle"]}
                for message in messages
            ],
        )


def main() -> None:
    logger.info("Starting to process icons")

    with next_icon_paths() as response:
        logger.info("Got the following response from SQS")
        logger.info(json.dumps(response))

    logger.info("Finished processing icons")


main()
