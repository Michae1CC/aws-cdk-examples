#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { config } from "dotenv";
import { ServiceStack } from "../lib/ServiceStack";

config();

const app = new cdk.App();
const serviceStack = new ServiceStack(app, "serviceStack", {});
