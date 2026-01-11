# syntax=docker/dockerfile:1

FROM --platform=linux/amd64 python:3.14-slim

# Prevents Python from writing pyc files.
ENV PYTHONDONTWRITEBYTECODE=1

# Keeps Python from buffering stdout and stderr to avoid situations where
# the application crashes without emitting any logs due to buffering.
ENV PYTHONUNBUFFERED=1

# Install the application dependencies
COPY requirements.txt ./
RUN : \
    && python -m pip install --no-cache-dir setuptools \
    && python -m pip install --no-cache-dir -r requirements.txt

# Copy in the source code
COPY app.py ./
EXPOSE 8080

# Run the application.
CMD python3 -m flask run --port 8080 --host=0.0.0.0