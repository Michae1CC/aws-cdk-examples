import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_dynamodb as dynamodb } from "aws-cdk-lib";

export class EcsAnywhereStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const pasteTable = new dynamodb.Table(this, "pasteTable", {
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
