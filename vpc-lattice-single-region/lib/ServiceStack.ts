import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_logs as logs,
  aws_vpclattice as vpclattice,
  CfnOutput,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface ServiceStackProps extends StackProps {
  latticeServiceNetwork: vpclattice.CfnServiceNetwork;
}

const VPC_CIDR = "10.0.0.0/16" as const;
const SERVICE_HTTP_PORT_NAME = "service-port";

export class ServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "vpc", {
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

    const ecsSecurityGroup = new ec2.SecurityGroup(this, "ecs-sg", {
      vpc: vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4",
    );

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTP,
      "Allow HTTP traffic from Ipv4",
    );

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTPS,
      "Allow HTTPS traffic from Ipv4",
    );

    // You need to allow the inbound rule vpc-lattice prefix to your security
    // group or tasks and health checks can fail.
    //
    // see:
    //  - https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-vpc-lattice-create-service.html
    //  - https://docs.aws.amazon.com/vpc/latest/userguide/working-with-aws-managed-prefix-lists.html
    const vpcLatticePrefixList = ec2.PrefixList.fromLookup(
      this,
      "vpc-lattice-prefix-list",
      {
        prefixListName: `com.amazonaws.${this.region}.vpc-lattice`,
      },
    );

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.prefixList(vpcLatticePrefixList.prefixListId),
      ec2.Port.HTTP,
    );

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
          protocol: ecs.Protocol.TCP,
          name: SERVICE_HTTP_PORT_NAME,
        },
      ],
    });

    const ecsService = new ecs.FargateService(this, "service", {
      cluster: cluster,
      taskDefinition: taskDefinition,
      assignPublicIp: false,
      securityGroups: [ecsSecurityGroup],
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    const vpcLatticeService = new vpclattice.CfnService(
      this,
      "lattice-service",
      {
        name: "my-lattice-service",
      },
    );

    // Create IAM role for ECS VPC Lattice integration
    const ecsVpcLatticeRole = new iam.Role(this, "ecs-vpc-lattice-role", {
      assumedBy: new iam.ServicePrincipal("ecs.amazonaws.com"),
      managedPolicies: [
        // Provides access to other AWS service resources required to manage VPC Lattice feature in ECS workloads on your behalf.
        // see: https://docs.aws.amazon.com/aws-managed-policy/latest/reference/AmazonECSInfrastructureRolePolicyForVpcLattice.html
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonECSInfrastructureRolePolicyForVpcLattice",
        ),
      ],
    });

    /**
     * An vpc lattice target group for the service internal alb.
     */
    // Create VPC Lattice Target Group for ECS
    const targetGroup = new vpclattice.CfnTargetGroup(
      this,
      "vpc-lattice-service-target-group",
      {
        type: "IP", // Use IP type for ECS Fargate tasks
        config: {
          protocol: "HTTP",
          port: 80,
          vpcIdentifier: vpc.vpcId,
          healthCheck: {
            enabled: true,
            path: "/",
            protocol: "HTTP",
            port: 80,
            healthyThresholdCount: 2,
            unhealthyThresholdCount: 3,
            healthCheckIntervalSeconds: 30,
            healthCheckTimeoutSeconds: 5,
          },
        },
      },
    );

    // Configure VPC Lattice for ECS Service using L1 construct
    const cfnEcsService = ecsService.node.defaultChild as ecs.CfnService;
    cfnEcsService.vpcLatticeConfigurations = [
      {
        targetGroupArn: targetGroup.attrArn,
        portName: SERVICE_HTTP_PORT_NAME,
        roleArn: ecsVpcLatticeRole.roleArn,
      },
    ];

    const listener = new vpclattice.CfnListener(this, "vpc-lattice-listener", {
      serviceIdentifier: vpcLatticeService.attrId,
      protocol: "HTTP",
      defaultAction: {
        forward: {
          targetGroups: [
            {
              targetGroupIdentifier: targetGroup.attrId,
              weight: 100,
            },
          ],
        },
      },
    });

    new vpclattice.CfnServiceNetworkServiceAssociation(
      this,
      "service-vpc-service-network-association",
      {
        serviceNetworkIdentifier: props.latticeServiceNetwork.attrId,
        serviceIdentifier: vpcLatticeService.attrId,
      },
    );

    new CfnOutput(this, "service-domain-name", {
      value: vpcLatticeService.attrDnsEntryDomainName,
    });
  }
}
