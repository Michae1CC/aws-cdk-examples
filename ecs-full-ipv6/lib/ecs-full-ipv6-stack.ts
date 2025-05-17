import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_logs as logs,
  aws_s3 as s3,
} from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { FlowLogDestination } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class EcsFullIpv6Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "vpc", {
      createInternetGateway: true,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      ipProtocol: ec2.IpProtocol.DUAL_STACK,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 20,
          ipv6AssignAddressOnCreation: true,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 20,
          ipv6AssignAddressOnCreation: true,
        },
      ],
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, "alb-sg", {
      vpc: vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
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
      ec2.Port.HTTP,
      "Allow HTTP traffic from Ipv4"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.HTTP,
      "Allow HTTP from Ipv6"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTPS,
      "Allow HTTPS traffic from Ipv4"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.HTTPS,
      "Allow HTTPS from Ipv6"
    );

    const ecsSecurityGroup = new ec2.SecurityGroup(this, "ecs-sg", {
      vpc: vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4"
    );

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv6"
    );

    ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.HTTP);

    const cloudwatchIpv6InterfaceEndpointSecurityGroup = new ec2.SecurityGroup(
      this,
      "cloudwatch-ipv6-interface-endpoint-sg",
      {
        vpc: vpc,
        allowAllOutbound: true,
        allowAllIpv6Outbound: true,
      }
    );

    cloudwatchIpv6InterfaceEndpointSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTP
    );
    cloudwatchIpv6InterfaceEndpointSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.HTTP
    );
    cloudwatchIpv6InterfaceEndpointSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTPS
    );
    cloudwatchIpv6InterfaceEndpointSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.HTTPS
    );

    // aws log driver does not support endpoint configuration, configure an
    // interface endpoint to work around this, see:
    // https://github.com/aws/containers-roadmap/issues/73
    new ec2.InterfaceVpcEndpoint(this, "cloudwatch-ipv6", {
      vpc: vpc,
      securityGroups: [cloudwatchIpv6InterfaceEndpointSecurityGroup],
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      privateDnsEnabled: true,
      dnsRecordIpType: ec2.VpcEndpointDnsRecordIpType.IPV6,
      ipAddressType: ec2.VpcEndpointIpAddressType.DUALSTACK,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    const cluster = new ecs.Cluster(this, "cluster", {
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

    const ecsTaskLogGroup = new logs.LogGroup(this, "ecs-task", {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "task-definition",
      {
        cpu: 256,
        memoryLimitMiB: 512,
      }
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

    // Create an s3 bucket to store the alb access logs
    const accessLogsBucket = new s3.Bucket(this, "alb-access-logs", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      transferAcceleration: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const loadBalancer = new elbv2.ApplicationLoadBalancer(
      this,
      "service-alb",
      {
        vpc: vpc,
        internetFacing: true,
        ipAddressType: elbv2.IpAddressType.DUAL_STACK,
        securityGroup: albSecurityGroup,
        http2Enabled: true,
      }
    );

    loadBalancer.logAccessLogs(accessLogsBucket);

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "target-group", {
      vpc: vpc,
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 80,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        protocol: elbv2.Protocol.HTTP,
        port: "80",
        path: "/",
      },
    });

    loadBalancer.addListener("http-listener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([targetGroup]),
    });

    targetGroup.addTarget(service);

    const vpcFlowLogsLogGroup = new logs.LogGroup(this, "vpc-flow-log", {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // The permissions for the flow logs role as suggested by the official documentation:
    //  see: https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs-iam-role.html
    const vpcFlowLogsRole = new iam.Role(this, "vpc-flow-logs", {
      assumedBy: new iam.ServicePrincipal("vpc-flow-logs.amazonaws.com"),
      inlinePolicies: {
        cloudwatch: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    vpc
      .selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS })
      .subnets.map((subnet, index) => {
        new ec2.FlowLog(this, `vpc-flow-logs-subnet-${index}`, {
          resourceType: ec2.FlowLogResourceType.fromSubnet(subnet),
          destination: FlowLogDestination.toCloudWatchLogs(
            vpcFlowLogsLogGroup,
            vpcFlowLogsRole
          ),
          maxAggregationInterval: ec2.FlowLogMaxAggregationInterval.ONE_MINUTE,
          trafficType: ec2.FlowLogTrafficType.ALL,
          logFormat: [
            ec2.LogFormat.ALL_DEFAULT_FIELDS,
            ec2.LogFormat.PKT_SRC_ADDR,
            ec2.LogFormat.PKT_DST_ADDR,
            ec2.LogFormat.ECS_CLUSTER_ARN,
            ec2.LogFormat.ECS_CLUSTER_NAME,
            ec2.LogFormat.ECS_CONTAINER_INSTANCE_ARN,
            ec2.LogFormat.ECS_CONTAINER_INSTANCE_ID,
            ec2.LogFormat.ECS_CONTAINER_ID,
            ec2.LogFormat.ECS_SERVICE_NAME,
            ec2.LogFormat.ECS_TASK_DEFINITION_ARN,
            ec2.LogFormat.ECS_TASK_ARN,
            ec2.LogFormat.ECS_TASK_ID,
          ],
        });
      });

    new cdk.CfnOutput(this, "alb-dns", {
      value: loadBalancer.loadBalancerDnsName,
    });

    // // TODO: CW logs and glue job
  }
}
