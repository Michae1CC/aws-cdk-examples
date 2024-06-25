import io
import json
from pprint import pprint
import logging
from typing import cast, TypedDict
from pprint import pprint
from PIL import Image

import boto3

bucket_arn = ""
object_path = "icons/icons8-bucket.png"

S3_CLIENT = boto3.client("s3")

size = 16, 16
s3_response: dict = S3_CLIENT.get_object(Bucket=bucket_arn, Key=object_path)
image_data: bytes = s3_response["Body"].read()
image = Image.open(io.BytesIO(image_data))
image.thumbnail(size, Image.Resampling.LANCZOS)
save_bytes_array = io.BytesIO()
image.save(save_bytes_array, format="png")
S3_CLIENT.put_object(
    Body=save_bytes_array.getvalue(),
    Bucket=bucket_arn,
    Key="icons/icons8-bucket-size-new.png",
)
