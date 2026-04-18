#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcLatticeStack } from "../lib/VpcLatticeStack";
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

// const vpcLatticeStack = new VpcLatticeStack(app, "vpc-lattice-stack", { env });
const dnsStack = new DnsStack(app, "dns-stack", { env });

const serviceStack = new ServiceStack(app, "service-stack", {
  env: env,
  crossRegionReferences: true,
  hostedZone: dnsStack.hostedZone,
});

// const clientStack = new ClientStack(app, "client-stack", {
//   env: env,
//   serviceNlb: serviceStack.serviceNlb,
// });
