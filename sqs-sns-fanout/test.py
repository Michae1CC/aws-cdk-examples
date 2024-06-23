import json
from pprint import pprint
import logging
from typing import cast, TypedDict
from pprint import pprint

event = {}

t = json.loads(json.loads(event["Body"])["Message"])["Records"][0]["s3"]["object"][
    "key"
]

pprint(t)
