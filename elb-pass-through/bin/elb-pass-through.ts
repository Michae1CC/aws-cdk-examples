#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { config } from "dotenv";
import { ElbPassThroughStack } from "../lib/elb-pass-through-stack";

// Environment variable setup
config();

const app = new cdk.App();
new ElbPassThroughStack(app, "ElbPassThroughStack", {
  env: {
    account: process.env.ACCOUNT,
    region: process.env.REGION,
  },
});
