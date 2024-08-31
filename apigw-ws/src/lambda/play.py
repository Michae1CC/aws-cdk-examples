#!/usr/bin/env python3

__author__ = "Michael Ciccotosto-Camp"
__version__ = ""

import os
import json
import logging

from typing import Any, Final

import boto3

CONNECT_TABLE_NAME: str = os.getenv("CONNECTION_TABLE_NAME") or ""

DYNAMO_CLIENT: Final[Any] = boto3.client("dynamodb")

logger: logging.Logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def handler(event: dict, _) -> dict:
    logger.info(json.dumps(event))

    if not CONNECT_TABLE_NAME:
        raise ValueError("No connection table arn set in environment.")

    connection_id = event["requestContext"]["connectionId"]
    event_body = json.loads(event["body"])

    logger.info(json.dumps(event_body))
    response = DYNAMO_CLIENT.get_item(
        TableName=CONNECT_TABLE_NAME,
        Key={"GameId": {"S": event_body["id"]}},
        ConsistentRead=True,
    )
    logger.info(json.dumps(response))

    API_GW_MANAGEMENT_CLIENT = boto3.client(
        "apigatewaymanagementapi",
        endpoint_url="https://61eql4dpu8.execute-api.us-east-1.amazonaws.com/prod/",
    )

    player1_connection: str | None = response["Item"]["Player1"]["S"]
    player2_connection: str | None = response["Item"]["Player2"]["S"]

    if player1_connection is None or player2_connection is None:
        raise ValueError("Both player connections are not set")

    other_player_connection: str = (
        player1_connection
        if player2_connection == connection_id
        else player2_connection
    )

    API_GW_MANAGEMENT_CLIENT.post_to_connection(
        Data=bytes(
            json.dumps(
                {
                    "type": "play",
                    "id": event_body["id"],
                    "tile": event_body["tile"],
                }
            ),
            encoding="utf8",
        ),
        ConnectionId=other_player_connection,
    )

    return {"statusCode": 200}
