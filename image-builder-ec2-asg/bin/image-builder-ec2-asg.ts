#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { ImageBuilderStack } from "../lib/ImageBuilderStack";
import { NginxClusterStack } from "../lib/NginxClusterStack";
import { VpcStack } from "../lib/VpcStack";
import { config } from "dotenv";

config();

const env: cdk.Environment = {
  account: process.env.ACCOUNT,
  region: process.env.REGION,
};

const app = new cdk.App();

const vpcStack = new VpcStack(app, "vpc-stack", {
  env: env,
});

const imageBuilderStack = new ImageBuilderStack(app, "image-builder-stack", {
  env: env,
  vpc: vpcStack.vpc,
});

new NginxClusterStack(app, "nginx-cluster-stack", {
  env: env,
  vpc: vpcStack.vpc,
  amiParameter: imageBuilderStack.amiParameter,
});
