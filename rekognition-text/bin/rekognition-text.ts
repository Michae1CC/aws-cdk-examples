#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { RekognitionTextStack } from "../lib/rekognition-text-stack";

const app = new cdk.App();
new RekognitionTextStack(app, "RekognitionTextStack", {});
