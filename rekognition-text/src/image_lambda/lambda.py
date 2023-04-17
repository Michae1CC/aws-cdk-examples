import os
import re
import json
import logging
import boto3
from typing import Final
from datetime import datetime

from botocore.utils import ClientError

dynamodb_client = boto3.client("dynamodb")
rekognition_client = boto3.client("rekognition")

TABLE_NAME: Final[str] = os.environ.get("DYNAMODB_TABLE") or ""
LICENSE_NO_RE: Final[re.Pattern] = re.compile("[0-9]{3} [0-9]{3} [0-9]{3}")
DATE_RE: Final[re.Pattern] = re.compile("[0-9]{2}.[0-9]{2}.[0-9]{2}")


def is_license(labels: dict) -> bool:
    all_labels: list[tuple[str, float]] = list(
        [(str(label["Name"]), float(label["Confidence"])) for label in labels["Labels"]]
    )
    filtered_labels = filter(lambda x: x[0] == "Drivers License", all_labels)
    # Only select labels with a big enough threshold
    filtered_labels = filter(lambda x: x[1] > 0.7, all_labels)
    return len(list(filtered_labels)) > 0


def get_license_no(labels: list[str]) -> str:
    return next(label for label in labels if LICENSE_NO_RE.match(label))


def get_effective_expiry(labels: list[str]) -> tuple[str, str]:
    date_str1, date_str2, *_ = [label for label in labels if DATE_RE.match(label)]
    # Convert to datetime objects
    date_format: str = r"%d.%m.%y"
    datetime1: datetime = datetime.strptime(date_str1, date_format)
    datetime2: datetime = datetime.strptime(date_str2, date_format)
    return tuple(date.isoformat() for date in sorted([datetime1, datetime2]))


def get_license_type(labels: list[str]) -> str:
    LICENSE_CLASSES: set[str] = {"L", "P1", "P2", "O"}
    for label in labels:
        if label.upper() in LICENSE_CLASSES:
            return label
    return "NA"


def get_license_class(labels: list[str]) -> str:
    LICENSE_TYPES: set[str] = {"C", "CA", "R", "RE", "LR", "MR", "HR", "HC", "MC"}
    for label in labels:
        if label.upper() in LICENSE_TYPES:
            return label
    return "NA"


def handler(event, context):
    logger: logging.Logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    logger.info("request: " + json.dumps(event))

    try:
        for record in event["Records"]:
            # Get the S3 bucket object info
            bucket_name = record["s3"]["bucket"]["name"]
            key = record["s3"]["object"]["key"]
            image_id = {
                "S3Object": {
                    "Bucket": bucket_name,
                    "Name": key,
                }
            }

            label_response: dict = rekognition_client.detect_labels(Image=image_id)
            logger.info(json.dumps(label_response))

            # Skip the image if it is not a license
            if not is_license(label_response):
                logger.info(f"Image {key} was not deemed to be a drivers license.")
                continue

            text_response: dict = rekognition_client.detect_text(Image=image_id)
            logger.info("text response" + json.dumps(text_response))
            detections: list[dict] = text_response["TextDetections"]

            # Construct a list of all the detected labels
            labels: list[str] = [label["DetectedText"] for label in detections]
            effective_date, expirary_date = get_effective_expiry(labels)
            dynamodb_client.put_item(
                TableName=TABLE_NAME,
                Item={
                    "LicenseNo": {"S": get_license_no(labels)},
                    "EffectiveDate": {"S": effective_date},
                    "ExpiraryDate": {"S": expirary_date},
                    "Class": {"S": get_license_class(labels)},
                    "Type": {"S": get_license_type(labels)},
                },
            )
    except ClientError as e:
        logger.error(e)
        return {"statusCode": 500, "body": str(e)}
