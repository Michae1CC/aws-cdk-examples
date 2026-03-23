#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { Ec2EbsStack } from "../lib/ec2-ebs-stack";

const app = new cdk.App();
new Ec2EbsStack(app, "Ec2EbsStack", {
  env: {
    region: "ap-southeast-2",
  },
});
