FROM node:21-slim

# Docker defaults to the root user. This line is defensively added to ensure the image doesn't break if the
# base image decides to change the user in future.
USER root

WORKDIR /coffee-app

COPY . .

RUN : \
    && npm i \
    && node --version \
    && npm --version \
    && npm run build:server \
    && npm run build:remix

ENTRYPOINT ["npm", "run", "start"]