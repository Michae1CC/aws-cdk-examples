import * as cdk from "aws-cdk-lib";
import {
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_dynamodb as dynamodb,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface ServiceStackProps extends cdk.StackProps {}

export class ServiceStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly flagTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
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

    this.vpc = new ec2.Vpc(this, "serviceVpc", {
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "service",
          cidrMask: 24,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    const dynamoDbEndpoint = this.vpc.addGatewayEndpoint("dynamoDbEndpoint", {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    dynamoDbEndpoint.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    dynamoDbEndpoint.addToPolicy(
      new iam.PolicyStatement({
        principals: [new iam.AnyPrincipal()],
        actions: ["dynamodb:*"],
        resources: [this.flagTable.tableArn],
      })
    );
  }
}
