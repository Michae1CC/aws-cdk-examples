#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { EcsFullIpv6Stack } from "../lib/ecs-full-ipv6-stack";

const app = new cdk.App();
new EcsFullIpv6Stack(app, "FullIpv6Stack", {});
