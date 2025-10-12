#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/VpcStack";
import { VpnStack } from "../lib/VpnStack";

const env: cdk.Environment = {
  region: "ap-southeast-2",
  account: "792309103169",
};

const app = new cdk.App();

const vpcStack = new VpcStack(app, "vpc-stack", { env });
const vpnStack = new VpnStack(app, "vpn-stack", { env, vpc: vpcStack.vpc });
