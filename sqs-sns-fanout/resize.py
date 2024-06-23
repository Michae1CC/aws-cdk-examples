import os
from PIL import Image

path = os.path.join("icons", "icons8-bucket.png")
path_out = os.path.join("icons", "icons8-bucket-size16.png")
size = 16, 16

image = Image.open(path)
image.thumbnail(size, Image.Resampling.LANCZOS)
image.save(path_out, "PNG")
