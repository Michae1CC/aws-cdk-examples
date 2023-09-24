import os
import json
import logging
from typing import TypeVar, Iterable, TypedDict, Any

DEFAULT_MAX_CONCURRENCY = 5
MAX_CONCURRENCY = int(os.getenv("MAX_CONCURRENCY") or DEFAULT_MAX_CONCURRENCY)


class BatchPayload(TypedDict):
    BaseUrl: str
    FileExtension: str
    LambdaConcur: str


class InputPayload(BatchPayload):
    Items: list[str]


class BatchItems(TypedDict):
    Items: list[str]
    BatchInput: BatchPayload


class OutputPayload(TypedDict):
    Tasks: list[BatchItems]


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
        "Tasks": [
            {
                "Items": item_partition,
                "BatchInput": {
                    "FileExtension": payload["FileExtension"],
                    "BaseUrl": payload["BaseUrl"],
                    "LambdaConcur": payload["LambdaConcur"],
                },
            }
            for item_partition in partition(payload["Items"], MAX_CONCURRENCY)
        ]
    }
