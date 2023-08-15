import logging
import json
import secrets

from typing import Any


def handler(event: Any, context: Any) -> dict[str, dict[str, str]] | None:
    logger: logging.Logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    logger.info("request: " + json.dumps(event))

    request_type: str = event["RequestType"]
    props: dict[str, str] = event["ResourceProperties"]

    string_length_as_string: str

    try:
        string_length_as_string = props["StringLength"]
    except KeyError:
        logger.error("No StringLength provided in context")
        raise

    string_length = int(string_length_as_string)

    match request_type:
        case "Create" | "Update":
            logging.info("Generating a new random string.")
            return {"Data": {"Value": generate_random_string(string_length)}}
        case "Delete":
            logging.info("Deleting Resource")
        case _:
            raise ValueError(f"Unexpected request type received: {request_type}")


def generate_random_string(length: int) -> str:
    # Each byte is converted into two hex digits. Truncate the string
    # at the user specified length.
    return secrets.token_hex(nbytes=length)[:length]
