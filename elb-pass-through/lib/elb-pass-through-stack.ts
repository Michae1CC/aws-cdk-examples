import * as cdk from "aws-cdk-lib";
import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_ecs_patterns as ecs_patterns,
  aws_iam as iam,
  aws_logs as logs,
  aws_route53 as route53,
  aws_certificatemanager as acm,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { join } from "path";

export class ElbPassThroughStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Global resources

    const domainName = "michaelciccotostocampawscdkexample.com";

    // Create route 53 resources.

    /**
     * Start by created a Route53 hosted zone. This is a DNS DB for a domain
     * consisting of zone file hosted on four name servers provided by DNS.
     *
     * Route53 in this case will double as our domain registrar as well as
     * our hosting provider.
     */
    const hostedZone = new route53.HostedZone(this, "awscdkexamplehostedzone", {
      zoneName: domainName,
      // keep the vpc empty since we would like to keep this as a public
      // hosted zone
    });

    // Create certificate manager resources

    const domainCertificate = new acm.Certificate(this, "exampleCertificate", {
      domainName: domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // Create EC2 and ECS resources

    const vpc = new ec2.Vpc(this, "fargateVpc", {
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "public-subnet",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    const securityGroup = new ec2.SecurityGroup(this, "bridgedFargateCluster", {
      vpc: vpc,
      allowAllOutbound: true,
      securityGroupName: "bridged-fargate-service",
    });

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4"
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv6"
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP traffic from Ipv4"
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(80),
      "Allow HTTP from Ipv6"
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS traffic from Ipv4"
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(443),
      "Allow HTTPS from Ipv6"
    );

    const cluster = new ecs.Cluster(this, "fargateCluster", {
      vpc: vpc,
      enableFargateCapacityProviders: true,
    });

    cluster.addDefaultCapacityProviderStrategy([
      {
        capacityProvider: "FARGATE",
        // Direct all the traffic in this cluster to Fargate
        weight: 1,
      },
    ]);

    /**
     * We can create both the fargate service and application load balancer
     * using the ApplicationLoadBalancedFargateService construct.
     */
    const applicationLoadBalancedFargateService =
      new ecs_patterns.ApplicationLoadBalancedFargateService(
        this,
        "bridgedFargateService",
        {
          assignPublicIp: true,
          certificate: domainCertificate,
          cluster: cluster,
          cpu: 512,
          desiredCount: 1,
          domainName: domainName,
          domainZone: hostedZone,
          listenerPort: 443,
          // Serve all of our traffic over https
          protocol: elbv2.ApplicationProtocol.HTTPS,
          // Setting this value as ALIAS will create an A record mapping the
          // designated IP address of the load balancer to the route53
          // domain name
          recordType:
            ecs_patterns.ApplicationLoadBalancedServiceRecordType.ALIAS,
          // Redirects http traffic to https
          redirectHTTP: true,
          securityGroups: [securityGroup],
          taskImageOptions: {
            image: ecs.ContainerImage.fromAsset(join(__dirname, "docker")),
          },
        }
      );

    // Create flowlogs resources

    const cloudWatchLogGroup = new logs.LogGroup(this, "fargateServiceVpc");

    const cloudwatchPublishPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
      ],
      resources: [cloudWatchLogGroup.logGroupArn],
    });

    const cloudwatchPublishRole = new iam.Role(this, "CloudWatchPublishRole", {
      assumedBy: new iam.ServicePrincipal("vpc-flow-logs.amazonaws.com"),
    });

    cloudwatchPublishRole.addToPolicy(cloudwatchPublishPolicy);
    new ec2.FlowLog(this, "vpcFlowLogs", {
      resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(cloudWatchLogGroup),
    });

    // Outputs

    new cdk.CfnOutput(this, "hostedzoneNs", {
      value: this.toJsonString(hostedZone.hostedZoneNameServers!),
      description: "NS records for the domain",
    });
  }
}
