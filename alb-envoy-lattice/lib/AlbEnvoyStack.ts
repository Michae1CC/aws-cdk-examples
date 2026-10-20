import * as path from "path";
import {
  aws_ec2 as ec2,
  aws_ecr_assets as ecrAssets,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_logs as logs,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Size,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface Props extends StackProps {
  vpc: ec2.Vpc;
}

const ENVOY_PORT = 10000;

export class AlbEnvoyStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    // TODO: We may need to add sg permissions for ecs to pass traffic to the lattice services

    const cluster = new ecs.Cluster(this, "envoy-cluster", {
      vpc: props.vpc,
    });

    /**
     * Shared by the managed instances and the awsvpc task ENIs. The ALB
     * ingress rule on the envoy port is added when the service is registered
     * as an ALB target.
     */
    const envoySecurityGroup = new ec2.SecurityGroup(this, "envoy-sg", {
      vpc: props.vpc,
      allowAllOutbound: true,
    });

    /**
     * The security group used by the ALB.
     */
    const albSecurityGroup = new ec2.SecurityGroup(this, "alb-sg", {
      vpc: props.vpc,
      allowAllOutbound: true,
    });

    envoySecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.HTTP);

    /**
     * ECS Managed Instances: ECS provisions and patches the EC2 instances.
     * Intel/AMD only, so the x86_64 envoy image is always schedulable.
     */
    const capacityProvider = new ecs.ManagedInstancesCapacityProvider(
      this,
      "envoy-managed-instances-capacity-provider",
      {
        subnets: props.vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnets,
        securityGroups: [envoySecurityGroup],
        instanceRequirements: {
          vCpuCountMin: 1,
          memoryMin: Size.gibibytes(2),
          cpuManufacturers: [
            ec2.CpuManufacturer.INTEL,
            ec2.CpuManufacturer.AMD,
          ],
        },
      },
    );
    cluster.addManagedInstancesCapacityProvider(capacityProvider);

    /**
     * Create a log group for the envoy containers.
     */
    const logGroup = new logs.LogGroup(this, "envoy-log-group", {
      logGroupName: "ecs/envoy",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /**
     * Create a task definition for the envoy service.
     */
    const taskDefinition = new ecs.TaskDefinition(
      this,
      "envoy-task-definition",
      {
        compatibility: ecs.Compatibility.MANAGED_INSTANCES,
        networkMode: ecs.NetworkMode.AWS_VPC,
        cpu: "512",
        memoryMiB: "1024",
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
      },
    );

    taskDefinition.addContainer("envoy", {
      essential: true,
      containerName: "envoy",
      image: ecs.ContainerImage.fromAsset(
        path.join(__dirname, "..", "docker"),
        {
          platform: ecrAssets.Platform.LINUX_AMD64,
        },
      ),
      portMappings: [{ containerPort: ENVOY_PORT, protocol: ecs.Protocol.TCP }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "lattice-proxy",
        logGroup: logGroup,
        mode: ecs.AwsLogDriverMode.NON_BLOCKING,
      }),
    });

    /**
     * Create an ECS service for envoy.
     * FargateService is the CDK construct for Managed Instances services: it
     * runs on the capacity provider below, not on Fargate.
     */
    const service = new ecs.FargateService(this, "envoy-service", {
      cluster,
      taskDefinition,
      desiredCount: 2,
      assignPublicIp: false,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      securityGroups: [envoySecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      capacityProviderStrategies: [
        {
          capacityProvider: capacityProvider.capacityProviderName,
          weight: 1,
        },
      ],
      circuitBreaker: { rollback: true },
    });
    service.node.addDependency(capacityProvider);

    const alb = new elbv2.ApplicationLoadBalancer(this, "public-alb", {
      vpc: props.vpc,
      internetFacing: true,
      clientKeepAlive: Duration.seconds(60),
      ipAddressType: elbv2.IpAddressType.IPV4,
      dropInvalidHeaderFields: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: albSecurityGroup,
    });

    const listener = alb.addListener("http-listener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: true,
    });

    listener.addTargets("envoy-targets", {
      port: ENVOY_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: "/healthcheck",
        healthyHttpCodes: "200",
      },
      deregistrationDelay: Duration.seconds(30),
    });

    new CfnOutput(this, "alb-dns-name", { value: alb.loadBalancerDnsName });
  }
}
