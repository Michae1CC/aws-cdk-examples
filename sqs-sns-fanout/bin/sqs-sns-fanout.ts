#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ServiceStack } from "../lib/ServiceStack";

const app = new cdk.App();
new ServiceStack(app, "SqsSnsFanoutStack", {});
