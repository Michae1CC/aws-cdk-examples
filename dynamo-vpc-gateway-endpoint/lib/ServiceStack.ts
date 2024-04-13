import * as cdk from "aws-cdk-lib";
import {
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_dynamodb as dynamodb,
  aws_lambda_nodejs as lambdaJs,
  aws_lambda as lambda,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

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

    const handler = new lambdaJs.NodejsFunction(this, "serviceLambda", {
      memorySize: 256,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      allowAllOutbound: true,
      allowPublicSubnet: false,
      vpc: this.vpc,
      bundling: {
        sourceMap: true,
      },
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
      },
      entry: path.join(__dirname, "..", "lambda", "service", "lambda.ts"),
      handler: "handler",
    });

    /**
     * Might have to add a security group for any compute to access these
     * gateway endpoint, see:
     * https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html
     * https://docs.aws.amazon.com/vpc/latest/userguide/working-with-aws-managed-prefix-lists.html
     */
  }
}
