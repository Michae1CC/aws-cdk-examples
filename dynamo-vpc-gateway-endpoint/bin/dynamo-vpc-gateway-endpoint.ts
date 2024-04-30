#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { config } from "dotenv";
import { ServiceStack } from "../lib/ServiceStack";
import { AuthStack } from "../lib/AuthStack";

config();

const app = new cdk.App();
const serviceStack = new ServiceStack(app, "serviceStack", {});
const authStack = new AuthStack(app, "authStack", {
  flagTable: serviceStack.flagTable,
  httpApiGateway: serviceStack.httpApiGateway,
});
