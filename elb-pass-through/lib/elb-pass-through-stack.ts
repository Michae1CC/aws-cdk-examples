import * as cdk from "aws-cdk-lib";
import {
  aws_cloudwatch as cloudwatch,
  aws_cloudwatch_actions as cloudwatch_actions,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_route53 as route53,
  aws_route53_targets as route53_targets,
  aws_sns as sns,
  aws_sns_subscriptions as sns_subscriptions,
  aws_certificatemanager as acm,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { join } from "path";

const HTTPS_PORT = 443;
const HTTP_PORT = 80;

export class ElbPassThroughStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Global resources

    if (process.env.DOMAIN_NAME === undefined) {
      throw new Error("No SNS email provided");
    }

    const domainName = process.env.DOMAIN_NAME;

    // Create route 53 resources.

    /**
     * Look up the hosted zone created using the registration process
     */
    const hostedZone = route53.HostedZone.fromLookup(
      this,
      "awscdkexamplehostedzone",
      {
        domainName,
        // Keep the vpc field empty since we would like to keep this as a public
        // hosted zone
      }
    );

    // Create certificate manager resources

    /**
     * This certificate is used for browsers to verify the legitimacy of the
     * domain.
     */
    const domainCertificate = new acm.Certificate(this, "exampleCertificate", {
      domainName: domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // Resources use to create our health check

    /**
     * Create a route53 health check that will make requests to the /healthcheck
     * path of our service.
     */
    const healthCheck = new route53.CfnHealthCheck(this, "serviceHealthCheck", {
      healthCheckConfig: {
        type: "HTTPS",
        requestInterval: cdk.Duration.seconds(10).toSeconds(),
        failureThreshold: 2,
        fullyQualifiedDomainName: domainName,
        port: HTTPS_PORT,
        resourcePath: "/healthcheck",
      },
    });

    /**
     * Create a metric that monitors the number of successful/failed checks
     */
    const healthCheckMetric = new cloudwatch.Metric({
      namespace: "AWS/Route53",
      metricName: "HealthCheckStatus",
      dimensionsMap: {
        HealthCheckId: healthCheck.attrHealthCheckId,
      },
      statistic: cloudwatch.Stats.MINIMUM,
      period: cdk.Duration.seconds(30),
    });

    /**
     * Create an alarm when the healthCheck fails too often for too long.
     */
    const healthCheckAlarm = healthCheckMetric.createAlarm(
      this,
      "route53Alarm",
      {
        actionsEnabled: true,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        threshold: 1,
        evaluationPeriods: 2,
        alarmDescription: "Route53 bad status",
      }
    );

    /**
     * Create an sns topic to alert engineers of a failed health check
     */
    const snsTopic = new sns.Topic(this, "SnsTopic");

    // Check that an email has been provided in our SNS topic, otherwise fail
    // the build
    if (process.env.SNS_EMAIL === undefined) {
      throw new Error("No SNS email provided");
    }

    snsTopic.addSubscription(
      new sns_subscriptions.EmailSubscription(process.env.SNS_EMAIL)
    );

    /**
     * Send a message to the SNS topic when our health check goes into alarm.
     */
    healthCheckAlarm;
    healthCheckAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));

    // Create EC2 and ECS resources

    /**
     * Create a VPC that occupies two AZs and has both a public and private
     * subnet. The NAT GWs are using for fargate instances within the private
     * subnet to discover/pull from ECR.
     */
    const vpc = new ec2.Vpc(this, "serviceVpc", {
      natGateways: 2,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "public-subnet",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "private-subnet",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    /**
     * The security group for our ALB should allow in coming traffic for HTTP,
     * HTTPS and ICMP from and source. It should also allow out going
     * connections to our fargate service.
     */
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

    /**
     * Our fargate security group should only allow incoming HTTPS requests
     * from our ALB. We will also any ICMP pings for diagnostic purposes, this
     * should be fine since our fargate service is not publicly accessible.
     */
    const fargateSecurityGroup = new ec2.SecurityGroup(
      this,
      "fargateSecurityGroup",
      {
        vpc: vpc,
        allowAllOutbound: true,
      }
    );

    albSecurityGroup.addEgressRule(
      fargateSecurityGroup,
      ec2.Port.tcp(HTTPS_PORT)
    );

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
      // ECS Fargate uses AWSVPC network mode to send traffic through to
      // instances. This means the network port will be same as the port used
      // by the container.
      ec2.Port.tcp(HTTPS_PORT)
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

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "taskDefinition",
      {
        cpu: 256,
      }
    );

    taskDefinition.addContainer("nginxSelfSigned", {
      essential: true,
      containerName: "nginxSelfSigned",
      image: ecs.ContainerImage.fromAsset(join(__dirname, "docker")),
      portMappings: [{ containerPort: HTTPS_PORT }],
    });

    const fargateService = new ecs.FargateService(this, "fargateService", {
      cluster,
      taskDefinition,
      deploymentAlarms: {
        alarmNames: [healthCheckAlarm.alarmName],
        behavior: ecs.AlarmBehavior.ROLLBACK_ON_ALARM,
      },
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      assignPublicIp: false,
      securityGroups: [fargateSecurityGroup],
      desiredCount: 1,
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
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
     * Create a HTTP listener which redirects to HTTPS
     */
    loadBalancer.addListener("httpListener", {
      port: HTTP_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        port: `${HTTPS_PORT}`,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        permanent: true,
      }),
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "targetGroup", {
      vpc: vpc,
      // Specifying a protocol and port of HTTPS_PORT and HTTPS (respectively)
      // will cause our ALB to communicate to our target group using HTTPS
      protocol: elbv2.ApplicationProtocol.HTTPS,
      port: HTTPS_PORT,
      healthCheck: {
        protocol: elbv2.Protocol.HTTPS,
        path: "/healthcheck",
      },
    });

    /**
     * Create a HTTPS listener which forwards traffic to the above target group
     * by default.
     */
    loadBalancer.addListener("httpsListener", {
      port: HTTPS_PORT,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      defaultAction: elbv2.ListenerAction.forward([targetGroup]),
      certificates: [domainCertificate],
    });

    targetGroup.addTarget(fargateService);
  }
}
