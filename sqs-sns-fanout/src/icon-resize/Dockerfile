FROM --platform=linux/amd64 python:3.12-slim
USER root

WORKDIR /app

ADD . /app

RUN : \
    && set -eu pipefail \
    && python -V \
    && pip install --trusted-host pypi.python.org -r requirements.in

CMD ["python", "app.py"]