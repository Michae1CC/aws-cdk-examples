import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_logs as logs,
  CfnOutput,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface ServiceStackProps extends StackProps {}

const VPC_CIDR = "10.0.0.0/16" as const;

export class ServiceStack extends Stack {
  public readonly vpc: ec2.Vpc;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "vpc", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 2,
      natGateways: 1,
      createInternetGateway: true,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr(VPC_CIDR),
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, "alb-sg", {
      vpc: this.vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4",
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTP,
      "Allow HTTP traffic from Ipv4",
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTPS,
      "Allow HTTPS traffic from Ipv4",
    );

    const ecsSecurityGroup = new ec2.SecurityGroup(this, "ecs-sg", {
      vpc: this.vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4",
    );

    ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.HTTP);

    const cluster = new ecs.Cluster(this, "cluster", {
      vpc: this.vpc,
      enableFargateCapacityProviders: true,
    });

    cluster.addDefaultCapacityProviderStrategy([
      {
        capacityProvider: "FARGATE",
        // Direct all the traffic in this cluster to Fargate
        weight: 1,
      },
    ]);

    const ecsTaskLogGroup = new logs.LogGroup(this, "ecs-task", {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "task-definition",
      {
        cpu: 256,
        memoryLimitMiB: 512,
      },
    );

    taskDefinition.addContainer("nginx", {
      essential: true,
      containerName: "nginx",
      image: ecs.ContainerImage.fromRegistry("nginx"),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "ecs",
        logGroup: ecsTaskLogGroup,
        mode: ecs.AwsLogDriverMode.NON_BLOCKING,
      }),
      portMappings: [
        {
          containerPort: 80,
          hostPort: 80,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    const service = new ecs.FargateService(this, "service", {
      cluster: cluster,
      taskDefinition: taskDefinition,
      assignPublicIp: false,
      securityGroups: [ecsSecurityGroup],
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, "service-alb", {
      vpc: this.vpc,
      internetFacing: false,
      ipAddressType: elbv2.IpAddressType.IPV4,
      securityGroup: albSecurityGroup,
      http2Enabled: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "target-group", {
      vpc: this.vpc,
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 80,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        protocol: elbv2.Protocol.HTTP,
        port: "80",
        path: "/",
      },
    });

    this.loadBalancer.addListener("http-listener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([targetGroup]),
    });

    targetGroup.addTarget(service);

    new CfnOutput(this, "alb-dns-name", {
      value: this.loadBalancer.loadBalancerDnsName,
    });
  }
}
