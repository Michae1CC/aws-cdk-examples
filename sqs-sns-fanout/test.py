import json
from pprint import pprint
import logging
from typing import cast, TypedDict

import boto3

SQS_CLIENT = boto3.client("sqs")
SQS_URL = ""


class SqsMessage(TypedDict):
    Body: str
    MD5OfBody: str
    MessageId: str
    ReceiptHandle: str


logger: logging.Logger = logging.getLogger(__name__)

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

pprint(sqs_response.keys())
messages = cast(list[SqsMessage], sqs_response.get("Messages", []))

for message in messages:
    logger.info(message["ReceiptHandle"])
    # print()
    # body_dict: dict = json.loads(message["Body"])
    # pprint(type(body_dict))
    # pprint(body_dict)
    # pprint(body_dict["Message"])
