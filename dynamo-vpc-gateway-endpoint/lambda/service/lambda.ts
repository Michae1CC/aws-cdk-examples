import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

export const handler = async () => {
  const getFeatureFlagCommand = await dynamoClient.send(
    new GetItemCommand({
      TableName: process.env.FEATURE_FLAG_TABLE_NAME!,
      Key: {
        Feature: {
          S: "HelloFeature",
        },
        Target: {
          S: `${process.env.CLIENT_ID}#${process.env.STAGE}`,
        },
      },
    })
  );

  const flagValue: boolean =
    getFeatureFlagCommand.Item === undefined
      ? false
      : getFeatureFlagCommand.Item.Value.BOOL!;

  console.log(
    `Got a flag value of ${flagValue} for SK: ${process.env.CLIENT_ID}#${process.env.STAGE}`
  );

  if (flagValue) {
    return {
      statusCode: 200,
      isBase64Encoded: false,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
      body: '<h2 style="color:red;">Hello feature enabled!<h2/>',
    };
  }

  return {
    statusCode: 200,
    isBase64Encoded: false,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
    body: "<h2>No feature enabled<h2/>",
  };
};
