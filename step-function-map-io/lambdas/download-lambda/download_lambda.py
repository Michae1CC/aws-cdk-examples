import os
import asyncio
import logging
import json
import urllib
from collections import Counter
from http import HTTPStatus
from enum import Enum
from pathlib import Path
from typing import Any, Callable, NamedTuple, TypedDict

import httpx


POP20_CC = list(
    map(
        lambda cc: f"{cc}/{cc}.gif",
        ("CN IN US ID BR PK NG BD RU JP MX PH VN ET EG DE IR TR CD FR").lower().split(),
    )
)

BASE_URL = "https://www.fluentpython.com/data/flags"

# Low concurrency default to avoid errors from remote site,
# such as 503 - Service Temporarily Unavailable
DEFAULT_CONCUR_REQ = 5
MAX_CONCUR_REQ = 1000


class BatchPayload(TypedDict):
    BaseUrl: str
    FileExtension: str
    LambdaConcur: str


class InputPayload(TypedDict):
    ResourcePaths: list[str]
    BatchInput: BatchPayload


class DownloadStatus(str, Enum):
    OK = "OK"
    NOT_FOUND = "NOT FOUND"
    ERROR = "ERROR"


class CompletedTask(NamedTuple):
    status: DownloadStatus
    message: str


class Event(TypedDict):
    Payload: InputPayload


def save_resource(img: bytes, filename: str) -> None:
    print("Saving: " + filename)


def filename_from_url(url: str):
    parsed_url = urllib.parse.urlparse(url)
    domain = parsed_url.netloc
    resource_filename = os.path.basename(parsed_url.path)
    return f"{domain}/{resource_filename}"


async def get_resource(client: httpx.AsyncClient, url: str) -> bytes:
    # Change so that we use the end part of the URL
    resp = await client.get(url, timeout=3.1, follow_redirects=True)
    resp.raise_for_status()
    return resp.content


async def download_one(
    client: httpx.AsyncClient,
    resource: str,
    base_url: str,
    semaphore: asyncio.Semaphore,
    file_extension: str,
) -> CompletedTask:
    url = f"{base_url}/{resource}"
    try:
        async with semaphore:
            image = await get_resource(client, url)
    except httpx.HTTPStatusError as exc:
        response = exc.response
        match response.status_code:
            case HTTPStatus.NOT_FOUND:
                status = DownloadStatus.NOT_FOUND
                message = f"Could not find: {response.url}"
            case _:
                status = DownloadStatus.ERROR
                message = (
                    f"HTTP error {response.status_code} - {response.reason_phrase}"
                )
    except httpx.RequestError as exc:
        status = DownloadStatus.ERROR
        message = f"{exc} {type(exc)}".strip()
    else:
        filename = filename_from_url(url)
        await asyncio.to_thread(save_resource, image, filename)
        status = DownloadStatus.OK
        message = f"Successfully downloaded: {base_url}/{resource}"

    return CompletedTask(status=status, message=message)


async def supervisor(
    resource_list: list[str], base_url: str, concur_req: int, file_extension: str
) -> list[CompletedTask]:
    completed_tasks: list[CompletedTask] = []
    semaphore = asyncio.Semaphore(concur_req)
    async with httpx.AsyncClient() as client:
        to_do = [
            download_one(client, resource, base_url, semaphore, file_extension)
            for resource in sorted(resource_list)
        ]
        for corountine in asyncio.as_completed(to_do):
            task_status = await corountine
            completed_tasks.append(task_status)

    return completed_tasks


def download_many(
    resource_list: list[str],
    base_url: str,
    concur_req: int,
    file_extension: str,
) -> list[CompletedTask]:
    corountine = supervisor(resource_list, base_url, concur_req, file_extension)
    completed_tasks: list[CompletedTask] = asyncio.run(corountine)

    return completed_tasks


def download_images(
    downloader: Callable[[list[str], str, int, str], list[CompletedTask]],
    default_concur_req: int,
    max_concur_req: int,
    resources: list[str],
    base_url: str,
    file_extension: str,
) -> list[CompletedTask]:
    logger: logging.Logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)

    actual_concur_req = min(default_concur_req, max_concur_req)
    return downloader(
        resources,
        base_url,
        actual_concur_req,
        file_extension,
    )


def handler(payload: InputPayload, _: Any) -> dict[str, Any]:
    logger: logging.Logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    logger.info("Payload:")
    logger.info(json.dumps(payload))

    completed_tasks = download_images(
        download_many,
        DEFAULT_CONCUR_REQ,
        int(payload["BatchInput"]["LambdaConcur"] or MAX_CONCUR_REQ),
        payload["ResourcePaths"],
        payload["BatchInput"]["BaseUrl"],
        payload["BatchInput"]["FileExtension"],
    )
    logger.info(json.dumps(completed_tasks))

    status_code = (
        200
        if all(task.status == DownloadStatus.OK for task in completed_tasks)
        else 503
    )
    errors = {
        "errors": [
            task.message for task in completed_tasks if task.status != DownloadStatus.OK
        ]
    }

    return {"statusCode": status_code, **({} if status_code == 200 else errors)}


if __name__ == "__main__":
    mock_input: InputPayload = {
        "ResourcePaths": POP20_CC,
        "BatchInput": {
            "BaseUrl": BASE_URL,
            "FileExtension": "gif",
            "LambdaConcur": "5",
        },
    }
    result = handler(mock_input, None)
