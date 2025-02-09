import os
import requests
from http import HTTPStatus
from urllib.parse import urljoin

from typing import Final

APP_ENDPOINT: Final[str] = os.getenv("APP_ENDPOINT") or ""


class TestIntegration:

    def test_invalid_create_address(self) -> None:
        response = requests.post(
            urljoin(APP_ENDPOINT, "address/create"),
            json={
                "unit": "U 19",
                "street_name": "Green",
                "suburb": "Springfield",
                "postcode": -1,
            },
        )

        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

    def test_invalid_create_meal(self) -> None:
        response = requests.post(
            urljoin(APP_ENDPOINT, "meal/create"),
            json={
                "cuisine": "French",
                "recipe": "Start with Tarragon",
                "price": "$20",
            },
        )

        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
