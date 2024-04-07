import * as cdk from "aws-cdk-lib";
import { aws_dynamodb as dynamodb } from "aws-cdk-lib";
import { Construct } from "constructs";

interface DynamoStackProps extends cdk.StackProps {}

export class DynamoStack extends cdk.Stack {
  public readonly flagTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoStackProps) {
    super(scope, id, props);

    this.flagTable = new dynamodb.Table(this, "flagTable", {
      partitionKey: {
        name: "feature",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "client",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
