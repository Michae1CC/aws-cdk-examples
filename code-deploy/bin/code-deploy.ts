#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CodeDeployStack } from "../lib/code-deploy-stack";
import { AppStack } from "../lib/app-stack";

const app = new cdk.App();
const appStack = new AppStack(app, "AppStack");
new CodeDeployStack(app, "CodeDeployStack", {
  appEcrRepository: appStack.appEcrRepository,
  deploymentGroup: appStack.deploymentGroup,
});
