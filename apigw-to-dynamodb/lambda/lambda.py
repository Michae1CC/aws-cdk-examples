import os
import json
import logging
import boto3

from botocore.exceptions import ClientError


def handler(event, context):
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    logger.info("request: " + json.dumps(event))
    subject = "Gelato"
    client = boto3.client("sns")
    topic_arn = os.environ["SNS_ARN"]

    try:
        flavour = event['Records'][0]['dynamodb']['Keys']['flavour']['S']
        message = f"Come try our new {flavour} flavour"
        sent_message = client.publish(
            TopicArn=topic_arn,
            Message=message,
            Subject=subject
        )
        if sent_message is not None:
            logger.info(f"Success - Message ID: {sent_message['MessageId']}")
        return {
            "statusCode": 200,
            "body": json.dumps("Success")
        }

    except ClientError as e:
        logger.error(e)
        return None
