#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/VpcStack";
import { VpnStack } from "../lib/VpnStack";
import { Route53Stack } from "../lib/Route53Stack";

const env: cdk.Environment = {
  region: "ap-southeast-2",
};

const app = new cdk.App();

const vpcStack = new VpcStack(app, "vpc-stack", { env });
const vpnStack = new VpnStack(app, "vpn-stack", { env, vpc: vpcStack.vpc });
const route53Stack = new Route53Stack(app, "route53-stack", {
  env,
  vpc: vpcStack.vpc,
});
