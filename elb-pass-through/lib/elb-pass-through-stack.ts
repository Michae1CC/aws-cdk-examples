import * as cdk from "aws-cdk-lib";
import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_logs as logs,
  aws_route53 as route53,
  aws_route53_targets as route53_targets,
  aws_certificatemanager as acm,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { join } from "path";

/**
 * The documented range that ECS might re-expose docker ports on
 */
export const ECS_DOCKER_PORT_RANGE = ec2.Port.tcpRange(32768, 60999);

export class ElbPassThroughStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Global resources

    const domainName = "awscdkeg.net";

    // Create route 53 resources.

    /**
     * Look up the hosted zone created using the registration process
     */
    const hostedZone = route53.HostedZone.fromLookup(
      this,
      "awscdkexamplehostedzone",
      {
        domainName,
        // keep the vpc empty since we would like to keep this as a public
        // hosted zone
      }
    );

    // Create certificate manager resources

    const domainCertificate = new acm.Certificate(this, "exampleCertificate", {
      domainName: domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // Create EC2 and ECS resources

    const vpc = new ec2.Vpc(this, "fargateVpc", {
      natGateways: 0,
      maxAzs: 3,
      subnetConfiguration: [
        {
          name: "public-subnet",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    const albSecurityGroup = new ec2.SecurityGroup(
      this,
      "bridgedFargateCluster",
      {
        vpc: vpc,
        allowAllOutbound: true,
        securityGroupName: "bridged-fargate-service",
      }
    );

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
      ec2.Port.tcp(80),
      "Allow HTTP traffic from Ipv4"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(80),
      "Allow HTTP from Ipv6"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS traffic from Ipv4"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(443),
      "Allow HTTPS from Ipv6"
    );

    const fargateSecurityGroup = new ec2.SecurityGroup(this, "fargateSG", {
      vpc: vpc,
      allowAllOutbound: true,
      securityGroupName: "fargateSG",
    });

    albSecurityGroup.addEgressRule(fargateSecurityGroup, ec2.Port.tcp(443));

    fargateSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4"
    );

    fargateSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv6"
    );

    fargateSecurityGroup.addIngressRule(
      albSecurityGroup,
      // Just 443, look at ecs networking modes
      ec2.Port.tcp(443),
    );

    const cluster = new ecs.Cluster(this, "fargateCluster", {
      //s3, ecr api or NAT gateway
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
     * Create a log group to capture the deployment output
     */
    const taskLogGroup = new logs.LogGroup(this, "deployLogs", {
      logGroupName: "/ecs/cdk-deploy",
      retention: logs.RetentionDays.FIVE_DAYS,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "taskDefinition",
      {
        cpu: 256,
      }
    );

    const nginxSelfSignedContainer = taskDefinition.addContainer(
      "nginxSelfSigned",
      {
        containerName: "nginxSelfSigned",
        image: ecs.ContainerImage.fromAsset(join(__dirname, "docker")),
        portMappings: [{ containerPort: 443 }],
        logging: new ecs.AwsLogDriver({
          logGroup: taskLogGroup,
          streamPrefix: "cdk-deploy",
        }),
      }
    );

    const fargateService = new ecs.FargateService(this, "fargateService", {
      cluster,
      taskDefinition,
      desiredCount: 1,
      // We will need to add a NAT gatway to get this working
      assignPublicIp: false,
      securityGroups: [fargateSecurityGroup],
    });

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, "serviceAlb", {
      vpc: vpc,
      internetFacing: true,
      ipAddressType: elbv2.IpAddressType.IPV4,
      securityGroup: albSecurityGroup,
      http2Enabled: true,
    });

    /**
     * Create an A record associating our load balancer's IP address to
     * the domain name create using route53
     */
    new route53.ARecord(this, "albARecord", {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(
        new route53_targets.LoadBalancerTarget(loadBalancer)
      ),
    });

    /**
     * Create a HTTP listener which redirects to HTTP
     */
    loadBalancer.addListener("httpListener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        port: "443",
        protocol: elbv2.ApplicationProtocol.HTTPS,
        permanent: true,
      }),
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "targetGroup", {
      vpc: vpc,
      // Specifying a protocol and port of 443 and HTTPS (respectively)
      // will cause our ALB to communicate to our target group using HTTPS
      protocol: elbv2.ApplicationProtocol.HTTPS,
      port: 443,
      healthCheck: {
        protocol: elbv2.Protocol.HTTPS,
        path: "/healthcheck",
      },
    });

    /**
     * Create a HTTPS listener which returns a 404 error by default
     */
    loadBalancer.addListener("httpsListener", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      defaultAction: elbv2.ListenerAction.forward([targetGroup]),
      certificates: [domainCertificate],
    });

    targetGroup.addTarget(fargateService);
  }
}
