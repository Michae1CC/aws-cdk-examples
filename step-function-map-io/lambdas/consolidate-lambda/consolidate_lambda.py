import logging
import json
from http import HTTPStatus
from typing import Any


def handler(payload: list[int], _: Any) -> bool:
    logger: logging.Logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    logger.info("Payload:")
    logger.info(json.dumps(payload))
    return all(int(task_status) == int(HTTPStatus.OK) for task_status in payload)
