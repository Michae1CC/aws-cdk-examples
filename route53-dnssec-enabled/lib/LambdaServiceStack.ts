import * as cdk from "aws-cdk-lib";
import {
  aws_lambda_nodejs as lambdaJs,
  aws_lambda as lambda,
  aws_route53 as route53,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

interface LambdaServiceStackProps extends cdk.StackProps {
  subDomainName: string;
  apexHostedZone: route53.IHostedZone;
  serviceHostedZone: route53.IHostedZone;
  serviceKsk: route53.CfnKeySigningKey;
}

export class LambdaServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LambdaServiceStackProps) {
    super(scope, id, props);

    const handler = new lambdaJs.NodejsFunction(this, "dsRecordValueLambda", {
      memorySize: 256,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      bundling: {
        sourceMap: true,
      },
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
      },
      description: "Generates a secure random string",
      entry: path.join(__dirname, "..", "lambda", "service", "lambda.ts"),
      handler: "handler",
    });
  }
}
