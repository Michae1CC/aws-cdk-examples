#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DistributionStack } from "../lib/DistributionStack";
import { DnsStack } from "../lib/DnsStack";
import { ServiceStack } from "../lib/ServiceStack";

const app = new cdk.App();
const dnsStack = new DnsStack(app, "dns-stack", {
  env: {
    region: "us-east-1",
    account: "786511284175",
  },
});
const service = new ServiceStack(app, "service-stack", {
  env: {
    region: "us-east-1",
    account: "786511284175",
  },
  hostedZone: dnsStack.hostedZone,
});
new DistributionStack(app, "distribution-stack", {
  env: {
    region: "us-east-1",
    account: "786511284175",
  },
  hostedZone: dnsStack.hostedZone,
  privateAlb: service.privateAlb,
  crossRegionReferences: true,
});
