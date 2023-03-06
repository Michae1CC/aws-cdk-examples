#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { FargateStack } from "../lib/fargate-stack";
import { LambdaStack } from "../lib/lambda-stack";

const app = new cdk.App();
new FargateStack(app, "FargateStack", {
  stackName: "fargate-stack",
});
new LambdaStack(app, "LambdaStack", {
  stackName: "lambda-stack",
});
