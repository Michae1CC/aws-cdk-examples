#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CentralDnsStack } from "../lib/central-dns-stack";

const app = new cdk.App();
new CentralDnsStack(app, "CentralDnsStack", {
  env: {
    region: "us-east-1",
  },
});
