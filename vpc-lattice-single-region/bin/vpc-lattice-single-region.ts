#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { ClientStack } from "../lib/ClientStack";
import { ServiceStack } from "../lib/ServiceStack";
import { VpcLatticeStack } from "../lib/VpcLatticeStack";

const env: cdk.Environment = {
  account: "786511284175",
  region: "ap-southeast-2",
};

const app = new cdk.App();

const clientStack = new ClientStack(app, "client-stack", {
  env: env,
});

const serviceStack = new ServiceStack(app, "service-stack", {
  env: env,
});

const vpcLatticeStack = new VpcLatticeStack(app, "vpc-lattice-stack", {
  env: env,
  clientVpc: clientStack.vpc,
  serviceVpc: serviceStack.vpc,
  serviceAlb: serviceStack.loadBalancer,
});
