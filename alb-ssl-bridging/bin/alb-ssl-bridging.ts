#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { config } from "dotenv";
import { AlbSslBridgingStack } from "../lib/alb-ssl-bridging-stack";

// Environment variable setup
config();
const app = new cdk.App();

new AlbSslBridgingStack(app, "AlbSslBridgingStack", {
  env: {
    account: process.env.ACCOUNT,
    region: process.env.REGION,
  },
});
