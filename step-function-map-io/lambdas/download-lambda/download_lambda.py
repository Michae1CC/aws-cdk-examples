import os
import asyncio
import logging
import json
import urllib
from http import HTTPStatus
from typing import Any, Callable, NamedTuple, Final, TypedDict

import boto3
import httpx


POP20_CC = list(
    map(
        lambda cc: f"{cc}/{cc}.gif",
        ("CN IN US ID BR PK NG BD RU JP MX PH VN ET EG DE IR TR CD FR ZZ")
        .lower()
        .split(),
    )
)

BASE_URL = "https://www.fluentpython.com/data/flags"

# Low concurrency default to avoid errors from remote site,
# such as 503 - Service Temporarily Unavailable
DEFAULT_CONCUR_REQ = 5
MAX_CONCUR_REQ = 1000

S3_CLIENT: Final[Any] = boto3.client("s3")
IMAGES_BUCKET_NAME = os.getenv("IMAGES_BUCKET_NAME")


class BatchPayload(TypedDict):
    BaseUrl: str
    LambdaConcur: str


class InputPayload(TypedDict):
    ResourcePaths: list[str]
    BatchInput: BatchPayload


class CompletedTaskError(NamedTuple):
    url: str
    statusCode: int
    message: str


class CompletedTaskSuccess(NamedTuple):
    url: str
    statusCode: int
    filename: str


CompletedTask = CompletedTaskError | CompletedTaskSuccess


class Event(TypedDict):
    Payload: InputPayload


def save_resource(img: bytes, filename: str) -> None:
    S3_CLIENT.put_object(Body=img, Bucket=IMAGES_BUCKET_NAME, Key=filename)


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
) -> CompletedTask:
    url = f"{base_url}/{resource}"
    try:
        async with semaphore:
            image = await get_resource(client, url)
    except httpx.HTTPStatusError as exc:
        response = exc.response
        status_code = response.status_code
        match status_code:
            case HTTPStatus.NOT_FOUND:
                message = f"Could not find: {response.url}"
            case _:
                message = (
                    f"HTTP error {response.status_code} - {response.reason_phrase}"
                )
    except httpx.RequestError as exc:
        status_code = 400
        message = f"{exc} {type(exc)}".strip()
    else:
        filename = filename_from_url(url)
        await asyncio.to_thread(save_resource, image, filename)
        status_code = int(HTTPStatus.OK)
        return CompletedTaskSuccess(url=url, statusCode=status_code, filename=filename)

    return CompletedTaskError(url=url, statusCode=int(status_code), message=message)


async def supervisor(
    resource_list: list[str], base_url: str, concur_req: int
) -> list[CompletedTask]:
    completed_tasks: list[CompletedTask] = []
    semaphore = asyncio.Semaphore(concur_req)
    async with httpx.AsyncClient() as client:
        to_do = [
            download_one(client, resource, base_url, semaphore)
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
) -> list[CompletedTask]:
    corountine = supervisor(resource_list, base_url, concur_req)
    completed_tasks: list[CompletedTask] = asyncio.run(corountine)

    return completed_tasks


def download_images(
    downloader: Callable[[list[str], str, int], list[CompletedTask]],
    default_concur_req: int,
    max_concur_req: int,
    resources: list[str],
    base_url: str,
) -> list[CompletedTask]:
    logger: logging.Logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)

    actual_concur_req = min(default_concur_req, max_concur_req)
    return downloader(
        resources,
        base_url,
        actual_concur_req,
    )


def handler(payload: InputPayload, _: Any) -> list[dict[str, Any]]:
    logger: logging.Logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    # if not IMAGES_BUCKET_NAME:
    #     error_message = "No IMAGES_BUCKET_NAME set"
    #     logger.error(error_message)
    #     return [{"statusCode": 500, "Message": error_message}]
    logger.info("Payload:")
    logger.info(json.dumps(payload))

    completed_tasks = download_images(
        download_many,
        DEFAULT_CONCUR_REQ,
        int(payload["BatchInput"]["LambdaConcur"] or MAX_CONCUR_REQ),
        payload["ResourcePaths"],
        payload["BatchInput"]["BaseUrl"],
    )
    logger.info(json.dumps(completed_tasks))

    return [task._asdict() for task in completed_tasks]


if __name__ == "__main__":
    mock_input: InputPayload = {
        "ResourcePaths": POP20_CC,
        "BatchInput": {
            "BaseUrl": BASE_URL,
            "LambdaConcur": "5",
        },
    }
    print(POP20_CC)
    result = handler(mock_input, None)
    from pprint import pprint

    pprint(result)
