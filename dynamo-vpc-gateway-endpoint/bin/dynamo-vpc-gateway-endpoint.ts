#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ServiceStack } from "../lib/ServiceStack";
import { ApiGatewayStack } from "../lib/ApiGatewayStack";

const app = new cdk.App();
const serviceStack = new ServiceStack(app, "dynamoStack", {});
const apiGatewayStack = new ApiGatewayStack(app, "apiGatewayStack", {
  vpc: serviceStack.vpc,
  flagTable: serviceStack.flagTable,
  applicationLoadBalancer: serviceStack.applicationLoadBalancer,
  albSecurityGroup: serviceStack.albSecurityGroup,
  lambdaListener: serviceStack.lambdaListener,
});
