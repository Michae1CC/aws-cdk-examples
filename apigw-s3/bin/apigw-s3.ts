#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { ApiStack } from "../lib/ApiStack";
import { ApiGatewayStack } from "../lib/ApiGatewayStack";
import { ApiGatewayBoilerplateStack } from "../lib/ApiGatewayBoilerplateStack";
import { StaticSiteStack } from "../lib/StaticSiteStack";
import { VpcStack } from "../lib/VpcStack";

const app = new cdk.App();

const env: cdk.Environment = {
  account: "792309103169",
  region: "ap-southeast-2",
};

const vpcStack = new VpcStack(app, "michael-test-vpc", {
  env: env,
});

const apiStack = new ApiStack(app, "michael-test-api", {
  env: env,
  vpc: vpcStack.vpc,
});

new ApiGatewayBoilerplateStack(app, "michael-test-apigw-boilerplate", {
  env: env,
});

const staticSiteStack = new StaticSiteStack(app, "michael-test-static-site", {
  env: env,
});

new ApiGatewayStack(app, "michael-test-apigw", {
  env: env,
  loadBalancer: apiStack.loadBalancer,
  staticSiteBucket: staticSiteStack.staticSiteBucket,
});
