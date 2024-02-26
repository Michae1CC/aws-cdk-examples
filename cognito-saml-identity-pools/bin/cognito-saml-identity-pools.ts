#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { config } from "dotenv";
import { Route53Stack } from "../lib/Route53Stack";
import { DynamodbStack } from "../lib/DynamoStack";
import { CognitoStack } from "../lib/CognitoStack";
import { FargateStack } from "../lib/FargateStack";
import { PropagatedTagSource } from "aws-cdk-lib/aws-ecs";

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
const fargateStack = new FargateStack(app, "FargateStack", {
  env,
  articleTable: dynamodbStack.articleTable,
  domainCertificate: route53Stack.domainCertificate,
  domainName: route53Stack.domainName,
  hostedZone: route53Stack.hostedZone,
  userPool: cognitoStack.userPool,
  userPoolDomainPrefix: cognitoStack.userPoolDomainPrefix,
  oktaSamlClient: cognitoStack.oktaSamlClient,
  oktaSamlIdentityProvider: cognitoStack.oktaSamlIdentityProvider,
});
