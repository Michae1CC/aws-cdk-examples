#!/usr/bin/env node
import { config } from "dotenv";
import * as cdk from "aws-cdk-lib/core";
import { VpcStack } from "../lib/VpcStack";
import { VpcLatticeStack } from "../lib/VpcLatticeStack";
import { AlbEnvoyStack } from "../lib/AlbEnvoyStack";

config();

const env: cdk.Environment = {
  account: process.env.ACCOUNT,
  region: process.env.REGION,
};

const app = new cdk.App();

const vpcStack = new VpcStack(app, "vpc-stack", {
  env: env,
});

const vpcLatticeStack = new VpcLatticeStack(app, "vpc-lattice-stack", {
  env: env,
  vpc: vpcStack.vpc,
});

new AlbEnvoyStack(app, "alb-envoy-stack", {
  env: env,
  vpc: vpcStack.vpc,
});
