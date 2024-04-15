import * as cdk from "aws-cdk-lib";
import {
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
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
        name: "Feature",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "Target",
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
        CLIENT_ID: "CLIENT1",
        STAGE: "Prod",
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

    const albSecurityGroup = new ec2.SecurityGroup(this, "albSecurityGroup", {
      vpc: this.vpc,
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv6"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(HTTP_PORT),
      "Allow HTTP traffic from Ipv4"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(HTTP_PORT),
      "Allow HTTP from Ipv6"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(HTTPS_PORT),
      "Allow HTTPS traffic from Ipv4"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(HTTPS_PORT),
      "Allow HTTPS from Ipv6"
    );

    albSecurityGroup.addEgressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(HTTP_PORT)
    );

    lambdaSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(HTTP_PORT)
    );

    const applicationLoadBalancer = new elbv2.ApplicationLoadBalancer(
      this,
      "internalApplicationLoadBalancer",
      {
        vpc: this.vpc,
        internetFacing: false,
        ipAddressType: elbv2.IpAddressType.IPV4,
        securityGroup: albSecurityGroup,
        http2Enabled: true,
      }
    );

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "targetGroup", {
      vpc: this.vpc,
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: HTTP_PORT,
    });

    applicationLoadBalancer.addListener("httpListener", {
      port: HTTP_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    /**
     * Might have to add a security group for any compute to access these
     * gateway endpoint, see:
     * https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html
     * https://docs.aws.amazon.com/vpc/latest/userguide/working-with-aws-managed-prefix-lists.html
     */
  }
}
