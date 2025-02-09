#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CodeDeployStack } from "../lib/code-deploy-stack";
import { AppStack } from "../lib/app-stack";
import { TestStack } from "../lib/test-stack";

const app = new cdk.App();
const appStack = new AppStack(app, "AppStack");
const testStack = new TestStack(app, "TestStack", {
  appLoadBalancer: appStack.appLoadBalancer,
});
new CodeDeployStack(app, "CodeDeployStack", {
  appEcrRepository: appStack.appEcrRepository,
  deploymentGroup: appStack.deploymentGroup,
  testRunnerStateMachine: testStack.testRunnerStateMachine,
});
