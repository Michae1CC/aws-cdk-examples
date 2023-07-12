#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { WafVpcStack } from "../lib/waf-vpc-stack";

const envSandbox = { account: "221318883170", region: "us-east-1" };

const app = new cdk.App();
new WafVpcStack(app, "WafVpcStack", { env: envSandbox });
