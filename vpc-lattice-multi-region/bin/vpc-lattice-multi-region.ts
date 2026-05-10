#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DnsStack } from "../lib/DnsStack";
import { ClientStack } from "../lib/ClientStack";
import { ServiceStack } from "../lib/ServiceStack";

import { config } from "dotenv";

config();

const app = new cdk.App();

const env: cdk.Environment = {
  region: process.env.REGION,
  account: process.env.ACCOUNT,
};

const dnsStack = new DnsStack(app, "dns-stack", { env });

const serviceStack = new ServiceStack(app, "service-stack", {
  env: {
    account: process.env.ACCOUNT,
    region: "us-east-1",
  },
  crossRegionReferences: true,
  hostedZone: dnsStack.hostedZone,
});

const clientStack = new ClientStack(app, "client-stack", {
  env: {
    account: process.env.ACCOUNT,
    region: "ap-southeast-2",
  },
  crossRegionReferences: true,
  nlbEndpointService: serviceStack.nlbEndpointService,
});
