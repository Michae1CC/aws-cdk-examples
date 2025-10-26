#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DistributionStack } from "../lib/DistributionStack";
import { DnsStack } from "../lib/DnsStack";

const app = new cdk.App();
const dnsStack = new DnsStack(app, "dns-stack", {
  env: {
    region: "ap-southeast-2",
  },
});
new DistributionStack(app, "distribution-stack", {
  env: {
    region: "us-east-1",
  },
  hostedZone: dnsStack.hostedZone,
  crossRegionReferences: true,
});
