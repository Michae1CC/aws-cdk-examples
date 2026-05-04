#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { SfnParallelWaitStack } from "../lib/sfn-parallel-wait-stack";

const app = new cdk.App();
new SfnParallelWaitStack(app, "parallel-wait-stack", {
  env: {
    region: "ap-southeast-2",
  },
});
