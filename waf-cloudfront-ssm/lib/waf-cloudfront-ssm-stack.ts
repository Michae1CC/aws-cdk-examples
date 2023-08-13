import * as cdk from "aws-cdk-lib";
import { aws_ssm as ssm, aws_ecs as ecs } from "aws-cdk-lib";
import { Construct } from "constructs";
import { TokenGenerator } from "./token-generator";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class WafCloudfrontSsmStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Create a secure token from our custom resource
     */
    const tokenConstructor = new TokenGenerator(this, "header-token", {
      length: 64,
    });

    const tokenParameterStore = new ssm.StringParameter(
      this,
      "header-token-parameter-store",
      { stringValue: tokenConstructor.value }
    );

    new cdk.CfnOutput(this, "header-token-output", {
      value: tokenParameterStore.stringValue,
    });
  }
}
