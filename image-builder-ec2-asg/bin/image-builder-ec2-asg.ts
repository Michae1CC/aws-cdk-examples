#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { ImageBuilderStack } from "../lib/ImageBuilderStack";
import { VpcStack } from "../lib/VpcStack";
import { config } from "dotenv";

config();

const env: cdk.Environment = {
  region: process.env.ACCOUNT,
  account: process.env.REGION,
};

const app = new cdk.App();

const vpcStack = new VpcStack(app, "vpc-stack", {
  env: env,
});

new ImageBuilderStack(app, "image-builder-stack", {
  env: env,
  vpc: vpcStack.vpc,
});
