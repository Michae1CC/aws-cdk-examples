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

const HTTPS_PORT = 443;
const HTTP_PORT = 80;

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
        effect: iam.Effect.ALLOW,
        actions: ["dynamodb:*"],
        resources: [this.flagTable.tableArn],
      })
    );

    const lambdaSecurityGroup = new ec2.SecurityGroup(
      this,
      "lambdaSecurityGroup",
      {
        vpc: this.vpc,
        allowAllOutbound: true,
      }
    );

    lambdaSecurityGroup.addIngressRule(
      ec2.Peer.prefixList("pl-02cd2c6b"),
      ec2.Port.tcp(HTTPS_PORT)
    );

    const handler = new lambdaJs.NodejsFunction(this, "serviceLambda", {
      memorySize: 256,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      allowPublicSubnet: false,
      vpc: this.vpc,
      securityGroups: [lambdaSecurityGroup],
      bundling: {
        sourceMap: true,
      },
      environment: {
        FEATURE_FLAG_TABLE_NAME: this.flagTable.tableName,
        CLIENT_ID: "Client1",
        STAGE: "prod",
        NODE_OPTIONS: "--enable-source-maps",
      },
      entry: path.join(__dirname, "..", "lambda", "service", "lambda.ts"),
      handler: "handler",
    });

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["dynamodb:*"],
        resources: [this.flagTable.tableArn],
      })
    );

    /**
     * Might have to add a security group for any compute to access these
     * gateway endpoint, see:
     * https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html
     * https://docs.aws.amazon.com/vpc/latest/userguide/working-with-aws-managed-prefix-lists.html
     */
  }
}
