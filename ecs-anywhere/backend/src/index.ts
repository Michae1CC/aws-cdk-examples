import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import {
  SQSClient,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import winston from "winston";

const SQS_URL = process.env.SQS_URL;
const DYNAMO_TABLE_NAME = process.env.DYNAMO_TABLE_NAME;
const REGION = process.env.REGION;

const ddbClient = new DynamoDBClient({
  region: REGION,
});

const sqsClient = new SQSClient({
  region: REGION,
});

// Application logger
const globalLogger = winston.createLogger({
  transports: [new winston.transports.Console()],
  format: winston.format.combine(
    winston.format.label({ label: "global" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
});

const sleep = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const main = async () => {
  if (REGION === undefined) {
    throw new Error("No region defined");
  }

  if (SQS_URL === undefined) {
    throw new Error("No SQS URL provided in env");
  }

  if (DYNAMO_TABLE_NAME === undefined) {
    throw new Error("No dynamodb table name provided in env");
  }

  while (true) {
    const getQueueAttributesResponse = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: SQS_URL,
        AttributeNames: ["ApproximateNumberOfMessages"],
      })
    );
    const approximateNumberOfMessages = Number(
      getQueueAttributesResponse.Attributes?.ApproximateNumberOfMessages ?? "0"
    );
    globalLogger.info(
      `Approximate number of messages found: ${approximateNumberOfMessages}`
    );

    if (approximateNumberOfMessages === 0) {
      await sleep(5000);
      continue;
    }

    const receiveMessageResponse = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: SQS_URL,
        MaxNumberOfMessages: 5,
        MessageAttributeNames: ["All"],
        VisibilityTimeout: 10,
        WaitTimeSeconds: 5,
      })
    );

    const messages = receiveMessageResponse["Messages"] ?? [];
    globalLogger.info(messages);

    for (let message of messages) {
      const body = JSON.parse(message["Body"]!) as { url: string };
      globalLogger.info(body);

      try {
        ddbClient.send(
          new PutItemCommand({
            TableName: DYNAMO_TABLE_NAME,
            Item: {
              id: {
                S: body.url,
              },
            },
          })
        );

        sqsClient.send(
          new DeleteMessageCommand({
            QueueUrl: SQS_URL,
            ReceiptHandle: message.ReceiptHandle,
          })
        );
      } catch (e) {
        globalLogger.error(e);
      }
    }
  }
};

main();
