import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log(event);
  const feature = event.queryStringParameters?.["feature"];
  const client = event.queryStringParameters?.["client"];
  const stage = event.queryStringParameters?.["stage"];
  const valueString = event.queryStringParameters?.["value"];
  const value =
    valueString !== undefined
      ? valueString === "true"
        ? true
        : false
      : undefined;
  //   process.env.FEATURE_FLAG_TABLE_NAME =
  //     "serviceStack-flagTable809D6BBE-1BOARLSDP9070";
  //   const feature = undefined;
  //   const client = undefined;
  //   const stage = undefined;
  //   const value = undefined;

  if (
    value !== undefined &&
    (feature === undefined || client === undefined || stage === undefined)
  ) {
    return {
      statusCode: 400,
      isBase64Encoded: false,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
      body: "Feature and target parameters must be set to change value",
    };
  }

  if (
    value !== undefined &&
    feature !== undefined &&
    client !== undefined &&
    stage !== undefined
  ) {
    const updateItemOutput = await dynamoClient.send(
      new UpdateItemCommand({
        TableName: process.env.FEATURE_FLAG_TABLE_NAME!,
        Key: {
          Feature: {
            S: feature,
          },
          Target: {
            S: `${client}#${stage}`,
          },
        },
        ExpressionAttributeNames: {
          "#Value": "Value",
        },
        ExpressionAttributeValues: {
          ":Value": {
            BOOL: value,
          },
        },
        UpdateExpression: "SET #Value = :Value",
        ReturnValues: "ALL_NEW",
      })
    );

    return {
      statusCode: 200,
      isBase64Encoded: false,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateItemOutput.Attributes),
    };
  }

  if (feature !== undefined && client !== undefined && stage !== undefined) {
    const getItemOutput = await dynamoClient.send(
      new GetItemCommand({
        TableName: process.env.FEATURE_FLAG_TABLE_NAME!,
        Key: {
          Feature: {
            S: feature,
          },
          Target: {
            S: `${client}#${stage}`,
          },
        },
      })
    );

    const returnedValue = getItemOutput.Item?.Value.BOOL;

    if (returnedValue === undefined) {
      return {
        statusCode: 404,
        isBase64Encoded: false,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
        body: "No flag found",
      };
    }

    return {
      statusCode: 200,
      isBase64Encoded: false,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(unmarshall(getItemOutput.Item!)),
    };
  }

  if (feature !== undefined && client !== undefined) {
    const queryFeatureClientOutput = await dynamoClient.send(
      new QueryCommand({
        TableName: process.env.FEATURE_FLAG_TABLE_NAME!,
        KeyConditionExpression:
          "#Feature = :Feature AND begins_with(#Target,:Client)",
        ExpressionAttributeNames: {
          "#Feature": "Feature",
          "#Target": "Target",
        },
        ExpressionAttributeValues: {
          ":Feature": {
            S: feature,
          },
          ":Client": {
            S: client,
          },
        },
      })
    );

    return {
      statusCode: 200,
      isBase64Encoded: false,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        queryFeatureClientOutput.Items?.map((item) => unmarshall(item))
      ),
    };
  }

  if (feature !== undefined) {
    const queryFeatureOutput = await dynamoClient.send(
      new QueryCommand({
        TableName: process.env.FEATURE_FLAG_TABLE_NAME!,
        KeyConditionExpression: "#Feature = :Feature",
        ExpressionAttributeNames: {
          "#Feature": "Feature",
        },
        ExpressionAttributeValues: {
          ":Feature": {
            S: feature,
          },
        },
      })
    );

    return {
      statusCode: 200,
      isBase64Encoded: false,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        queryFeatureOutput.Items?.map((item) => unmarshall(item))
      ),
    };
  }

  const scanOutput = await dynamoClient.send(
    new ScanCommand({
      TableName: process.env.FEATURE_FLAG_TABLE_NAME!,
    })
  );

  return {
    statusCode: 200,
    isBase64Encoded: false,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(scanOutput.Items?.map((item) => unmarshall(item))),
  };
};
