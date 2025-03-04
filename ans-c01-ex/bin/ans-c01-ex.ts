#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Ex1_4Stack } from "../lib/ans-c01-ex1-4-stack";
import { Ex8_P1Stack } from "../lib/ans-c01-ex8-p1stack";
import { Ex8_P2Stack } from "../lib/ans-c01-ex8-p2stack";

const app = new cdk.App();
// new Ex1_4Stack(app, "Ex1-4Stack", {});
const ex8_p1Stack = new Ex8_P1Stack(app, "Ex8-P1Stack", {
  env: {
    region: "us-east-1",
  },
});

new Ex8_P2Stack(app, "Ex8-P2Stack", {
  transitGateway: ex8_p1Stack.transitGateway,
  env: {
    region: "us-east-2",
  },
});
