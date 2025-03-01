#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Ex1_2Stack } from "../lib/ans-c01-ex-stack";

const app = new cdk.App();
new Ex1_2Stack(app, "Ex1-2Stack", {});
