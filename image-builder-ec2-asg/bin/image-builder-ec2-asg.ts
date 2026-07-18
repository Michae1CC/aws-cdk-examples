#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { ImageBuilderStack } from "../lib/ImageBuilderStack";
import { NginxClusterStack } from "../lib/NginxClusterStack";
import { VpcStack } from "../lib/VpcStack";
import { config } from "dotenv";
import { CloudfrontStack } from "../lib/CloudfrontStack";
import { DnsStack } from "../lib/DnsStack";
import { CloudfrontTenantStack } from "../lib/CloudfrontTenantStack";

config();

const env: cdk.Environment = {
  account: process.env.ACCOUNT,
  region: process.env.REGION,
};

const app = new cdk.App();

const dnsStack = new DnsStack(app, "dns-stack", {
  env: env,
});

const vpcStack = new VpcStack(app, "vpc-stack", {
  env: env,
});

const imageBuilderStack = new ImageBuilderStack(app, "image-builder-stack", {
  env: env,
  vpc: vpcStack.vpc,
});

const nginxClusterStack = new NginxClusterStack(app, "nginx-cluster-stack", {
  env: env,
  vpc: vpcStack.vpc,
  amiParameter: imageBuilderStack.amiParameter,
});

const cloudfrontStack = new CloudfrontStack(app, "cloudfront-stack", {
  env: {
    account: process.env.ACCOUNT,
    region: "us-east-1",
  },
  nginxClusterNlb: nginxClusterStack.nlb,
  hostedZone: dnsStack.hostedZone,
});

const cloudfrontTenantStack = new CloudfrontTenantStack(
  app,
  "cloudfront-tenant-stack",
  {
    env: {
      account: process.env.ACCOUNT,
      region: "us-east-1",
    },
    distribution: cloudfrontStack.distribution,
  },
);
