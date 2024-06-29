#!/usr/bin/env python3

__author__ = "Michael Ciccotosto-Camp"
__version__ = ""

import os
import json
import logging
import math
import time
from typing import cast, Any, Final, TypedDict

import boto3


RESOURCES_STRING: Final[str] = os.environ.get("RESOURCES_STRING") or ""

CLOUDWATCH_CLIENT: Final = boto3.client("cloudwatch")
ECS_CLIENT: Final = boto3.client("ecs")
SQS_CLIENT: Final = boto3.client("sqs")

logger: logging.Logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class ResourceInfo(TypedDict):
    Size: int
    SqsUrl: str
    Cluster: str
    ServiceName: str


def get_metric_value(
    ecs_task_count: int, approximate_number_of_messages_visible: int, /
) -> int:
    acceptable_messages_per_task = 5

    return 1 + (
        approximate_number_of_messages_visible
        / (acceptable_messages_per_task * ecs_task_count + 1)
    )


def handler(event: Any, context: Any):
    if not RESOURCES_STRING:
        logger.error("No RESOURCE_STRING set in environment")

    resources: list[ResourceInfo] = cast(
        list[ResourceInfo], json.loads(RESOURCES_STRING)
    )

    logger.info("Using the following resources: " + json.dumps(resources))

    iterations: int = 6

    for _ in range(iterations):
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
                get_queue_attributes_response["Attributes"][
                    "ApproximateNumberOfMessages"
                ]
            )
            metric_value = get_metric_value(
                ecs_task_count, approximate_number_of_messages_visible
            )

            logger.info(
                json.dumps(
                    {
                        "ecs_task_count": ecs_task_count,
                        "approximate_number_of_messages_visible ": approximate_number_of_messages_visible,
                        "metric_value": metric_value,
                    }
                ),
            )

            # publish the metric, see: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/publishingMetrics.html
            put_metric_data_response = CLOUDWATCH_CLIENT.put_metric_data(
                Namespace="Service/ImageResize",
                MetricData=[
                    {
                        "MetricName": "EcsTargetMetric",
                        "Dimensions": [
                            {
                                "Name": "IconSize",
                                "Value": f'size{resource_info["Size"]}',
                            }
                        ],
                        "Value": metric_value,
                        "StorageResolution": 1,
                    }
                ],
            )

        seconds_in_minute: int = 60
        time.sleep(seconds_in_minute / iterations)
