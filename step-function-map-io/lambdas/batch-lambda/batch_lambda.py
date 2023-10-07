#!/usr/bin/env python3

__author__ = "Michael Ciccotosto-Camp"
__version__ = ""

import os
import json
import logging
from typing import TypeVar, Iterable, TypedDict, Any

DEFAULT_MAX_CONCURRENCY = 5
MAX_CONCURRENCY = int(os.getenv("MAX_CONCURRENCY") or DEFAULT_MAX_CONCURRENCY)


class BatchPayload(TypedDict):
    baseUrl: str
    lambdaConcur: str


class InputPayload(BatchPayload):
    resourcePaths: list[str]


class BatchResources(TypedDict):
    resourcePaths: list[str]
    batchInput: BatchPayload


class OutputPayload(TypedDict):
    tasks: list[BatchResources]


T = TypeVar("T")


def partition(iterable: Iterable[T], size: int) -> list[list[T]]:
    lst = list(iterable)
    return [lst[index : index + size] for index in range(0, len(lst), size)]


def handler(payload: InputPayload, _: Any) -> OutputPayload:
    logger: logging.Logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    logger.info("Payload:")
    logger.info(json.dumps(payload))

    return {
        "tasks": [
            {
                "resourcePaths": resource_partition,
                "batchInput": {
                    "baseUrl": payload["baseUrl"],
                    "lambdaConcur": payload["lambdaConcur"],
                },
            }
            for resource_partition in partition(
                payload["resourcePaths"], MAX_CONCURRENCY
            )
        ]
    }
