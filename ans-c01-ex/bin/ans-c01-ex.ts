#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Ex1_4Stack } from "../lib/ans-c01-ex1-4-stack";
import { Ex6Stack } from "../lib/ans-c01-ex6stack";
import { Ex8_P1Stack } from "../lib/ans-c01-ex8-p1stack";
import { Ex8_P2Stack } from "../lib/ans-c01-ex8-p2stack";
import { Ex9Stack } from "../lib/ans-c01-ex9stack";
import { Ex14Stack } from "../lib/ans-c01-ex14stack";

const app = new cdk.App();

new Ex1_4Stack(app, "Ex1-4Stack", {});

new Ex6Stack(app, "Ex6Stack", {});

const ex8P1Tgw1Stack = new Ex8_P1Stack(app, "Ex8-P1Tgw1Stack", {
  vpcCidr: "10.0.0.0/16",
  transitGatewayAsn: 64512,
  env: {
    region: "us-east-1",
  },
});

const ex8P1Tgw2Stack = new Ex8_P1Stack(app, "Ex8-P1Tgw2Stack", {
  vpcCidr: "10.1.0.0/16",
  transitGatewayAsn: 64513,
  env: {
    region: "us-east-2",
  },
});

new Ex8_P2Stack(app, "Ex8-P2Stack", {
  transitGateway: ex8P1Tgw1Stack.transitGateway,
  env: {
    region: "us-east-1",
  },
});

new Ex9Stack(app, "Ex9Stack", {});

new Ex14Stack(app, "Ex14Stack", {});
