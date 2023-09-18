import os
import asyncio
import logging
import json
from collections import Counter
from http import HTTPStatus
from enum import Enum
from pathlib import Path
from typing import Callable, NamedTuple

import httpx


POP20_CC = ("ZZ CN IN US ID BR PK NG BD RU JP MX PH VN ET EG DE IR TR CD FR").split()

BASE_URL = "https://www.fluentpython.com/data/flags"
DEST_DIR = Path("downloaded")

# low concurrency default to avoid errors from remote site,
# such as 503 - Service Temporarily Unavailable
DEFAULT_CONCUR_REQ = 5
MAX_CONCUR_REQ = 1000


class DownloadStatus(str, Enum):
    OK = "OK"
    NOT_FOUND = "NOT FOUND"
    ERROR = "ERROR"


class CompletedTask(NamedTuple):
    status: DownloadStatus
    message: str


def save_item(img: bytes, filename: str) -> None:
    (DEST_DIR / filename).write_bytes(img)


async def get_item(client: httpx.AsyncClient, base_url: str, item: str) -> bytes:
    url = f"{base_url}/{item}/{item}.gif".lower()
    resp = await client.get(url, timeout=3.1, follow_redirects=True)
    resp.raise_for_status()
    return resp.content


async def download_one(
    client: httpx.AsyncClient, item: str, base_url: str, semaphore: asyncio.Semaphore
) -> CompletedTask:
    try:
        async with semaphore:
            image = await get_item(client, base_url, item)
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
        filename = f"{item}".strip() + f"{os.extsep}gif"
        await asyncio.to_thread(save_item, image, filename)
        status = DownloadStatus.OK
        message = f"Successfully downloaded: {base_url}/{item}"

    return CompletedTask(status=status, message=message)


async def supervisor(
    item_list: list[str], base_url: str, concur_req: int
) -> list[CompletedTask]:
    completed_tasks: list[CompletedTask] = []
    semaphore = asyncio.Semaphore(concur_req)
    async with httpx.AsyncClient() as client:
        to_do = [
            download_one(client, item, base_url, semaphore)
            for item in sorted(item_list)
        ]
        for corountine in asyncio.as_completed(to_do):
            task_status = await corountine
            completed_tasks.append(task_status)

    return completed_tasks


def download_many(
    item_list: list[str], base_url: str, concur_req: int
) -> list[CompletedTask]:
    corountine = supervisor(item_list, base_url, concur_req)
    completed_tasks: list[CompletedTask] = asyncio.run(corountine)

    return completed_tasks


def main(
    downloader: Callable[[list[str], str, int], list[CompletedTask]],
    default_concur_req: int,
    max_concur_req: int,
) -> None:
    logger: logging.Logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)

    DEST_DIR.mkdir(exist_ok=True)
    actual_concur_req = min(default_concur_req, max_concur_req)
    completed_tasks = downloader(
        POP20_CC,
        BASE_URL,
        actual_concur_req,
    )
    logger.info(json.dumps(completed_tasks))
    print(json.dumps(completed_tasks))


if __name__ == "__main__":
    main(download_many, DEFAULT_CONCUR_REQ, MAX_CONCUR_REQ)
