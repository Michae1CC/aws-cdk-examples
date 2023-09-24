import os
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


class OutputPayload(TypedDict):
    Items: list[str]
    BatchInput: BatchPayload


T = TypeVar("T")


def partition(iterable: Iterable[T], size: int) -> list[list[T]]:
    lst = list(iterable)
    return [lst[index : index + size] for index in range(0, len(lst), size)]


def handler(payload: InputPayload, context: Any) -> list[OutputPayload]:
    logger: logging.Logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)

    return [
        {
            "Items": items,
            "BatchInput": {
                "FileExtension": payload["FileExtension"],
                "BaseUrl": payload["BaseUrl"],
                "LambdaConcur": payload["LambdaConcur"],
            },
        }
        for items in partition(payload["Items"], MAX_CONCURRENCY)
    ]
