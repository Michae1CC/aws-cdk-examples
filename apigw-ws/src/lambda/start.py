#!/usr/bin/env python3

__author__ = "Michael Ciccotosto-Camp"
__version__ = ""

import os
import json
import logging
import uuid

from typing import Any, Callable, NamedTuple, Final, TypedDict

import boto3

CONNECT_TABLE_NAME: str = os.getenv("CONNECTION_TABLE_NAME") or ""

DYNAMO_CLIENT: Final[Any] = boto3.client("dynamodb")

logger: logging.Logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def handler(event, _):
    logger.info(json.dumps(event))

    if not CONNECT_TABLE_NAME:
        raise ValueError("No connection table arn set in environment.")

    new_game_id: str = str(uuid.uuid4())
    connection_id = event["requestContext"]["connectionId"]

    DYNAMO_CLIENT.put_item(
        TableName=CONNECT_TABLE_NAME,
        Item={"GameId": {"S": new_game_id}, "Player1": {"S": connection_id}},
    )

    API_GW_MANAGEMENT_CLIENT = boto3.client(
        "apigatewaymanagementapi",
        endpoint_url="https://61eql4dpu8.execute-api.us-east-1.amazonaws.com/prod/",
    )
    API_GW_MANAGEMENT_CLIENT.post_to_connection(
        Data=bytes(
            json.dumps(
                {
                    "type": "init",
                    "id": new_game_id,
                }
            ),
            encoding="utf8",
        ),
        ConnectionId=connection_id,
    )

    return {"statusCode": 200}
