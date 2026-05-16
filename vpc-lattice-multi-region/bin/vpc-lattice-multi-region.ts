#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DnsStack } from "../lib/DnsStack";
import { ConsumerStack } from "../lib/ConsumerStack";
import { ServiceStack } from "../lib/ServiceStack";

import { config } from "dotenv";

config();

const app = new cdk.App();

const dnsStack = new DnsStack(app, "dns-stack", {
  env: {
    account: process.env.ACCOUNT,
    region: "us-east-1",
  },
});

const serviceStack = new ServiceStack(app, "service-stack", {
  env: {
    account: process.env.ACCOUNT,
    region: "us-east-1",
  },
  crossRegionReferences: true,
  hostedZone: dnsStack.hostedZone,
});

const clientStack = new ConsumerStack(app, "consumer-stack", {
  env: {
    account: process.env.ACCOUNT,
    region: "ap-southeast-2",
  },
  crossRegionReferences: true,
  nlbEndpointService: serviceStack.nlbEndpointService,
});
