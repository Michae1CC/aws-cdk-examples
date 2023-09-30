import logging
import json
from http import HTTPStatus
from typing import Any, Callable, NamedTuple, TypedDict


class CompletedTask(NamedTuple):
    url: str
    status_code: int


def handler(payload: list[CompletedTask], _: Any) -> dict[str, bool]:
    logger: logging.Logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    logger.info("Payload:")
    logger.info(json.dumps(payload))
    return {
        "AllSucceeded": all(task.status_code == int(HTTPStatus.OK) for task in payload)
    }
