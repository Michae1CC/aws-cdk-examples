#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DynamoStack } from "../lib/DynamoStack";
import { VpcStack } from "../lib/VpcStack";

const app = new cdk.App();
const dynamoStack = new DynamoStack(app, "dynamoStack", {});
const vpcStack = new VpcStack(app, "vpcStack", {
  flagTable: dynamoStack.flagTable,
});
