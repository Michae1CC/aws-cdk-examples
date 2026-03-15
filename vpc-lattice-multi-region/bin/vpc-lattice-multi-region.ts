#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcLatticeStack } from "../lib/VpcLatticeStack";
import { DnsStack } from "../lib/DnsStack";
import { ServiceStack } from "../lib/ServiceStack";

const app = new cdk.App();

const env: cdk.Environment = {
  region: "us-east-1",
  account: "786511284175",
};

// const vpcLatticeStack = new VpcLatticeStack(app, "vpc-lattice-stack", { env });
const dnsStack = new DnsStack(app, "dns-stack", { env });

const serviceStack = new ServiceStack(app, "service-stack", {
  env: env,
  hostedZone: dnsStack.hostedZone,
});
