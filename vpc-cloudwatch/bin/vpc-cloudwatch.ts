#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { VpcCloudwatchStack } from "../lib/vpc-cloudwatch-stack";

const app = new cdk.App();
new VpcCloudwatchStack(app, "VpcCloudwatchStack", {});
