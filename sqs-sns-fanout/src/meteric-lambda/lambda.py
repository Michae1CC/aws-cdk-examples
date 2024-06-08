#!/usr/bin/env python3

__author__ = "Michael Ciccotosto-Camp"
__version__ = ""

import os
import contextlib
import json
import logging
import math
from typing import cast, Generator, Final, TypedDict

import boto3


class ResourceInfo(TypedDict):
    SqsUrl: str
    Cluster: str
    ServiceName: str


RESOURCES_STRING: Final[str] = os.environ.get("SQS_URL") or ""

ECS_CLIENT: Final = boto3.client("ecs")
SQS_CLIENT: Final = boto3.client("sqs")

logging.basicConfig(level=logging.INFO)
logger: logging.Logger = logging.getLogger()


def get_metric_value(
    ecs_task_count: int, approximate_number_of_messages_visible: int, /
) -> int:
    acceptable_messages_per_task = 5

    if ecs_task_count == 0 and approximate_number_of_messages_visible == 0:
        return 1
    elif approximate_number_of_messages_visible == 0:
        return 0
    elif ecs_task_count == 0 and approximate_number_of_messages_visible > 0:
        return 2

    return 1 + math.ceil(
        approximate_number_of_messages_visible
        / (acceptable_messages_per_task * ecs_task_count + 1)
    )


def handler():
    if not RESOURCES_STRING:
        logger.error("No RESOURCE_STRING set in environment")

    resources: list[ResourceInfo] = cast(
        list[ResourceInfo], json.loads(RESOURCES_STRING)
    )

    logger.info("Using the following resources: " + json.dumps(resources))

    for resource_info in resources:
        sqs_url = resource_info["SqsUrl"]
        service_name = resource_info["ServiceName"]
        cluster = resource_info["Cluster"]

        list_tasks_response = ECS_CLIENT.list_tasks(
            serviceName=service_name, cluster=cluster
        )
        get_queue_attributes_response = SQS_CLIENT.get_queue_attributes(
            QueueUrl=sqs_url, AttributeNames=["ApproximateNumberOfMessages"]
        )

        if list_tasks_response.get("nextToken"):
            logger.error(
                "The number of tasks has exceeded the maximum number of tasks in the list_task response."
            )

        ecs_task_count = len(list_tasks_response["taskArns"])
        approximate_number_of_messages_visible = int(
            get_queue_attributes_response["Attributes"]["ApproximateNumberOfMessages"]
        )
        metric_value = get_metric_value(
            ecs_task_count, approximate_number_of_messages_visible
        )
