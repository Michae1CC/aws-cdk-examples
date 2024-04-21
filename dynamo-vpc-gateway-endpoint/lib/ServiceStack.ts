import * as cdk from "aws-cdk-lib";
import {
  aws_apigatewayv2 as apigatewayv2,
  aws_apigatewayv2_integrations as apigatewayv2_integrations,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_elasticloadbalancingv2_targets as elbv2_targets,
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
  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    /**
     * A regional mapping from the region name to the aws managed prefix list
     * names and ids for dynamodb. You may need to add an entry if you
     * are deploying to a region that I haven't included. You can find the name key
     * and ID value in the vpc console under the "Managed prefix lists" sub section.
     */
    const cfnRegionToManagedPrefixList = new cdk.CfnMapping(
      this,
      "cfnRegionToManagedPrefixList",
      {
        mapping: {
          "us-east-1": {
            prefixListName: "com.amazonaws.us-east-1.dynamodb",
            prefixListId: "pl-02cd2c6b",
          },
          "us-east-2": {
            prefixListName: "com.amazonaws.us-east-2.dynamodb",
            prefixListId: "pl-4ca54025",
          },
          "us-west-1": {
            prefixListName: "com.amazonaws.us-west-1.dynamodb",
            prefixListId: "pl-6ea54007",
          },
          "us-west-2": {
            prefixListName: "com.amazonaws.us-west-2.dynamodb",
            prefixListId: "pl-00a54069",
          },
          "ap-southeast-2": {
            prefixListName: "com.amazonaws.ap-southeast-2.dynamodb",
            prefixListId: "pl-62a5400b",
          },
        },
      }
    );

    const flagTable = new dynamodb.Table(this, "flagTable", {
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

    const vpc = new ec2.Vpc(this, "serviceVpc", {
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

    const dynamoDbEndpoint = vpc.addGatewayEndpoint("dynamoDbEndpoint", {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    dynamoDbEndpoint.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    dynamoDbEndpoint.addToPolicy(
      new iam.PolicyStatement({
        principals: [new iam.AnyPrincipal()],
        effect: iam.Effect.ALLOW,
        actions: ["dynamodb:*"],
        resources: [flagTable.tableArn],
      })
    );

    const lambdaSecurityGroup = new ec2.SecurityGroup(
      this,
      "lambdaSecurityGroup",
      {
        vpc: vpc,
        allowAllOutbound: true,
      }
    );

    lambdaSecurityGroup.addIngressRule(
      ec2.Peer.prefixList(
        cfnRegionToManagedPrefixList.findInMap(this.region, "prefixListId")
      ),
      ec2.Port.tcp(HTTPS_PORT)
    );

    const handler = new lambdaJs.NodejsFunction(this, "serviceLambda", {
      memorySize: 256,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      allowPublicSubnet: false,
      vpc: vpc,
      securityGroups: [lambdaSecurityGroup],
      bundling: {
        sourceMap: true,
      },
      environment: {
        FEATURE_FLAG_TABLE_NAME: flagTable.tableName,
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
        resources: [flagTable.tableArn],
      })
    );

    const albSecurityGroup = new ec2.SecurityGroup(this, "albSecurityGroup", {
      vpc: vpc,
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

    lambdaSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(HTTP_PORT)
    );

    const applicationLoadBalancer = new elbv2.ApplicationLoadBalancer(
      this,
      "internalApplicationLoadBalancer",
      {
        vpc: vpc,
        internetFacing: false,
        // Denying GW traffic is needed for two reasons:
        // - Since this alb sits in a vpc with no public subnet, there is no
        //    IG that can route traffic to it.
        // - If this is set to true, an ingress rule to allow all in bound
        //    Ipv4 tcp traffic on port 80 is added to the LB security group.
        //    This could be a security risk later on down the track.
        denyAllIgwTraffic: true,
        ipAddressType: elbv2.IpAddressType.IPV4,
        securityGroup: albSecurityGroup,
        http2Enabled: true,
      }
    );

    // For some reason, if denyAllIgwTraffic is set while ipAddressType
    // is set to Ipv4 only, then we need to explicity remove the
    // "ipv6.deny_all_igw_traffic" attribute, otherwise stack creation fails
    // with:
    //  "Load balancer attribute key 'ipv6.deny_all igw traffic' is not
    //   supported on load balancers with IP address type 'ipv4'."
    // Likely an oversight of this construct's implementation.
    // For more on attributes, see:
    //  https://docs.aws.amazon.com/elasticloadbalancing/latest/application/application-load-balancers.html#load-balancer-attributes
    applicationLoadBalancer.removeAttribute("ipv6.deny_all_igw_traffic");

    const lambdaListener = applicationLoadBalancer.addListener("httpListener", {
      port: HTTP_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    lambdaListener.addTargets("serviceTarget", {
      targets: [new elbv2_targets.LambdaTarget(handler)],
      healthCheck: {
        enabled: false,
      },
    });

    const httpApiGateway = new apigatewayv2.HttpApi(this, "httpApiGateway", {});

    /**
     * Traffic originating from the api-gateway is tunnelled into the vpc
     * via a vpc link. This vpc link is injected into the vpc through an
     * elastic network interface (ENI). Security groups need to be configured
     * on the ENI to communicate with other resources
     * within the vpc. From the perspective of the vpc link's ENI, traffic is
     * routed out to other resources in the vpc. Since security groups are
     * stateful, we only need egress rules for tcp traffic.
     */
    const vpcLinkSecurityGroup = new ec2.SecurityGroup(
      this,
      "vpcLinkSecurityGroup",
      {
        vpc: vpc,
        allowAllOutbound: true,
      }
    );

    vpcLinkSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4"
    );

    vpcLinkSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv6"
    );

    albSecurityGroup.addIngressRule(
      vpcLinkSecurityGroup,
      ec2.Port.tcp(HTTP_PORT),
      "Allows inbound traffic from api gateway vpc link"
    );

    httpApiGateway.addRoutes({
      path: "/service",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2_integrations.HttpAlbIntegration(
        "albIntegration",
        lambdaListener,
        {
          vpcLink: new apigatewayv2.VpcLink(this, "albVpcLink", {
            vpc: vpc,
            securityGroups: [vpcLinkSecurityGroup],
          }),
        }
      ),
    });

    new cdk.CfnOutput(this, "apiGatewayRootUrl", {
      description: "The root URL for the HttpApi Gateway.",
      value: httpApiGateway.url!,
    });
  }
}
