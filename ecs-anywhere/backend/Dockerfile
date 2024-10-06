FROM --platform=linux/amd64 node:20

USER root
WORKDIR /app

COPY ./package.json ./package.json
COPY ./tsconfig.json ./tsconfig.json
COPY ./src ./src

RUN : \
    && set -eu pipefail \
    && npm install \
    && npm run build:prod

COPY ./static ./build/static

EXPOSE 3000
CMD ["node", "./build/index.js"]