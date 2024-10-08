#!/usr/bin/env python3

__author__ = "Michael Ciccotosto-Camp"
__version__ = ""

import os
import json
import logging
import uuid

from datetime import datetime, timedelta
from typing import Any, Final

import boto3

CONNECT_TABLE_NAME: str = os.getenv("CONNECTION_TABLE_NAME") or ""
WEBSOCKET_URL: str = os.getenv("WEBSOCKET_URL") or ""

DYNAMO_CLIENT: Final[Any] = boto3.client("dynamodb")

logger: logging.Logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def change_protocol_to_https(endpoint: str):
    return "https" + endpoint[len("wss") :]


def handler(event, _):
    logger.info(json.dumps(event))

    if not CONNECT_TABLE_NAME:
        raise ValueError("No connection table arn set in environment.")

    new_game_id: str = str(uuid.uuid4())
    connection_id = event["requestContext"]["connectionId"]

    DYNAMO_CLIENT.put_item(
        TableName=CONNECT_TABLE_NAME,
        Item={
            "GameId": {"S": new_game_id},
            "Player1": {"S": connection_id},
            # The ttl attribute must in the Unix epoch time format:
            # see: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html
            "ttl": {"N": str((datetime.now() + timedelta(hours=6)).timestamp())},
        },
    )

    API_GW_MANAGEMENT_CLIENT = boto3.client(
        "apigatewaymanagementapi",
        endpoint_url=change_protocol_to_https(WEBSOCKET_URL),
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
