#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { config } from "dotenv";
import { Route53 } from "../lib/Route53";
import { DnssecStack } from "../lib/DnssecStack";
import { LambdaServiceStack } from "../lib/LambdaServiceStack";

config();

const env = {
  account: process.env.ACCOUNT,
  region: "us-east-1",
};

const app = new cdk.App();
const route53Stack = new Route53(app, "Route53", { env });
new DnssecStack(app, "DnssecStack", {
  subDomainName: route53Stack.subDomainName,
  apexHostedZone: route53Stack.apexHostedZone,
  serviceHostedZone: route53Stack.serviceHostedZone,
  serviceKsk: route53Stack.serviceKsk,
  env,
});
new LambdaServiceStack(app, "LambdaServiceStack", {
  env,
  serviceDomainName: route53Stack.subDomainName,
  serviceHostedZone: route53Stack.serviceHostedZone,
});
