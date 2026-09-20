#!/usr/bin/env node
import { config } from "dotenv";
import * as cdk from "aws-cdk-lib/core";
import { VpcStack } from "../lib/VpcStack";
import { RdsStack } from "../lib/RdsStack";

config();

const env: cdk.Environment = {
  account: process.env.ACCOUNT,
  region: process.env.REGION,
};

const app = new cdk.App();

const vpcStack = new VpcStack(app, "vpc-stack", {
  env: env,
});
