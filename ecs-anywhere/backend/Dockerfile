FROM --platform=linux/arm64 node:20
# FROM node:20

USER root
WORKDIR /app

COPY ./package.json ./package.json
COPY ./tsconfig.json ./tsconfig.json
COPY ./src ./src

RUN : \
    && set -eu pipefail \
    && npm install \
    && npm run build

CMD ["node", "./build/index.js"]