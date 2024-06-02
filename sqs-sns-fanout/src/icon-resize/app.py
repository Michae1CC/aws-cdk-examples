#!/usr/bin/env python3

__author__ = "Michael Ciccotosto-Camp"
__version__ = ""

import os
import contextlib
import json
import logging
from typing import Generator, Final

import boto3

SQS_URL: Final[str] = os.environ.get("SQS_URL") or ""
ICONS_BUCKET_ARN: Final[str] = os.environ.get("ICONS_BUCKET_ARN") or ""

SQS_CLIENT: Final = boto3.client("sqs")

logger: logging.Logger = logging.getLogger(__name__)


@contextlib.contextmanager
def next_icon_paths() -> Generator[dict, None, None]:

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

    yield sqs_response

    SQS_CLIENT.delete_message(
        QueueUrl=SQS_URL, ReceiptHandle=sqs_response["Messages"]["ReceiptHandle"]
    )


def main() -> None:
    logger.info("Starting to process icons")

    with next_icon_paths() as response:
        logger.info("Got the following response from SQS")
        logger.info(json.dumps(response))

    logger.info("Finished processing icons")
