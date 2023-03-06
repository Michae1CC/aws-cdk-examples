FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:12
USER root

COPY . .

RUN npm install
RUN npm run build

CMD ["index.handler"]
