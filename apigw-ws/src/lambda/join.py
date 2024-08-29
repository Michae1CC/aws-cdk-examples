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


def handler(event, _):
    logger.info(json.dumps(event))

    if not CONNECT_TABLE_NAME:
        raise ValueError("No connection table arn set in environment.")

    connection_id = event["requestContext"]["connectionId"]
    event_body = json.dumps(event["body"])

    DYNAMO_CLIENT.update_item(
        TableName=CONNECT_TABLE_NAME,
        Key={"GameId": {"S": event_body["game_id"]}},
        UpdateExpression="SET Player2 = :Player2",
        ExpressionAttributeValues={":Player2": {"S": connection_id}},
    )
    response = DYNAMO_CLIENT.get_item(
        TableName=CONNECT_TABLE_NAME,
        Key={"GameId": {"S": event_body["game_id"]}},
        ConsistentRead=True,
    )
    logger.info(json.dumps(response))

    API_GW_MANAGEMENT_CLIENT = boto3.client(
        "apigatewaymanagementapi",
        endpoint_url="https://nk6yi2vprd.execute-api.us-east-1.amazonaws.com/prod",
    )

    for connection in [response["Item"]["Player1"], response["Item"]["Player2"]]:
        API_GW_MANAGEMENT_CLIENT.post_to_connection(
            Data=bytes(
                json.dumps(
                    {
                        "type": "join",
                        "game_id": event_body["game_id"],
                    }
                ),
                encoding="utf8",
            ),
            ConnectionId=connection,
        )

    return {"statusCode": 200}
