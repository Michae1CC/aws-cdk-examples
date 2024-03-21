#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { config } from "dotenv";
import { Route53 } from "../lib/Route53";

config();

const env = {
  account: process.env.ACCOUNT,
  region: "us-east-1",
};

const app = new cdk.App();
new Route53(app, "Route53", { env });
