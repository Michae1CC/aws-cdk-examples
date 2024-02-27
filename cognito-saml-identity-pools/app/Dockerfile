FROM --platform=linux/amd64 node:21-slim

# Docker defaults to the root user. This line is defensively added to ensure the image doesn't break if the
# base image decides to change the user in future.
USER root

WORKDIR /app

COPY . .

RUN : \
    && set -eu pipefail \
    && npm i \
    && node --version \
    && npm --version \
    && npm run build

EXPOSE 3000
ENTRYPOINT ["npm", "run", "start"]