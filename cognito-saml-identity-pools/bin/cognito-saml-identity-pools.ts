#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { config } from "dotenv";
import { Route53Stack } from "../lib/Route53Stack";
import { DynamodbStack } from "../lib/DynamoStack";
import { CognitoStack } from "../lib/CognitoStack";

config();

const app = new cdk.App();

const env = {
  account: process.env.ACCOUNT,
  region: process.env.REGION,
};

const route53Stack = new Route53Stack(app, "Route53Stack", { env });
const dynamodbStack = new DynamodbStack(app, "DynamoStack", { env });
const cognitoStack = new CognitoStack(app, "CognitoStack", {
  env,
  domainName: route53Stack.domainName,
  articleTable: dynamodbStack.articleTable,
});
