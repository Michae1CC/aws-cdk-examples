#!/usr/bin/env node
import { config } from "dotenv";
import * as cdk from "aws-cdk-lib/core";
import { VpcStack } from "../lib/VpcStack";
import { RdsStack } from "../lib/RdsStack";
import { PgAdminStack } from "../lib/PgAdminStack";

config();

const env: cdk.Environment = {
  account: process.env.ACCOUNT,
  region: process.env.REGION,
};

const app = new cdk.App();

cdk.Tags.of(app).add("Customer", "Internal");
cdk.Tags.of(app).add("Environment", "Non-Production");
cdk.Tags.of(app).add("Product", "null");
cdk.Tags.of(app).add("Owner", "Michael Ciccotostocamp");
cdk.Tags.of(app).add("Project", "null");
cdk.Tags.of(app).add("map-migrated", "MAP 1");

const vpcStack = new VpcStack(app, "vpc-stack", {
  env: env,
});

const rdsStack = new RdsStack(app, "rds-stack", {
  env: env,
  vpc: vpcStack.vpc,
});

const pgAdminStack = new PgAdminStack(app, "pg-admin-stack", {
  env: env,
  vpc: vpcStack.vpc,
  rdsDatabaseInstanceSg: rdsStack.rdsDatabaseInstanceSg,
});
