#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { ApiGatewayStack } from "../lib/ApiGatewayStack";
import { ApiGatewayBoilerplateStack } from "../lib/ApiGatewayBoilerplateStack";
import { StaticSiteStack } from "../lib/StaticSiteStack";

const app = new cdk.App();

const env: cdk.Environment = {
  account: "792309103169",
  region: "ap-southeast-2",
};

new ApiGatewayBoilerplateStack(app, "michael-test-apigw-boilerplate", {
  env: env,
});

const staticSiteStack = new StaticSiteStack(app, "michael-test-static-site", {
  env: env,
});

new ApiGatewayStack(app, "michael-test-apigw", {
  env: env,
  staticSiteBucket: staticSiteStack.staticSiteBucket,
});
