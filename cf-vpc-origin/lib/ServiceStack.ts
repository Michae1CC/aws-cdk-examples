import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_iam as iam,
  aws_route53 as route53,
} from "aws-cdk-lib";
import * as path from "path";

export class ServiceStack extends cdk.Stack {
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Create a VPC that occupies two AZs and has both a public and private
     * subnet. The NAT GWs are using for fargate instances within the private
     * subnet to discover/pull from ECR.
     */
    const vpc = new ec2.Vpc(this, "vpc", {
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
    const albSecurityGroup = new ec2.SecurityGroup(this, "alb-sg", {
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

    /**
     * Our fargate security group should only allow incoming HTTPS requests
     * from our ALB. We will also any ICMP pings for diagnostic purposes, this
     * should be fine since our fargate service is not publicly accessible.
     */
    const serviceSecurityGroup = new ec2.SecurityGroup(
      this,
      "serviceSecurityGroup",
      {
        vpc: vpc,
        allowAllOutbound: true,
      }
    );

    albSecurityGroup.addEgressRule(serviceSecurityGroup, ec2.Port.HTTPS);

    serviceSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4"
    );

    serviceSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv6"
    );

    serviceSecurityGroup.addIngressRule(
      albSecurityGroup,
      // ECS Fargate uses AWSVPC network mode to send traffic through to
      // instances. This means the network port will be same as the port used
      // by the container.
      ec2.Port.HTTPS
    );

    const cluster = new ecs.Cluster(this, "ecs-cluster", {
      vpc: vpc,
    });

    // ResourceInitializationError: Unable to launch instance(s) for capacity
    // provider service-stack-managedinstancecapacityprovider5F8F3F4C-50kJgqCJxOCh.
    // UnauthorizedOperation: You are not authorized to perform this operation.
    // User: arn:aws:sts::786511284175:assumed-role/service-stack-managedinstancecapacityprovidermanage-Slc4nfSyRSFj/ECSManagedInstances
    // is not authorized to perform: iam:PassRole on resource:
    // arn:aws:iam::786511284175:role/service-stack-instanceprofileInstanceRoleC62B5C46-xQt9UFlgbGL4
    // because no identity-based policy allows the iam:PassRole action.
    // RequestId: a439d91f-ae2e-40f6-b983-c246fd2aeaad

    const instanceProfile = new iam.InstanceProfile(
      this,
      "instance-profile",
      {}
    );

    const managedInstanceCapacityProvider =
      new ecs.ManagedInstancesCapacityProvider(
        this,
        "managed-instance-capacity-provider",
        {
          ec2InstanceProfile: instanceProfile,
          subnets: vpc.privateSubnets,
          instanceRequirements: {
            vCpuCountMin: 1,
            memoryMin: cdk.Size.gibibytes(1),
            cpuManufacturers: [ec2.CpuManufacturer.AMD],
          },
          securityGroups: [serviceSecurityGroup],
        }
      );

    cluster.addManagedInstancesCapacityProvider(
      managedInstanceCapacityProvider
    );

    const taskDefinition = new ecs.TaskDefinition(this, "task-definition", {
      memoryMiB: "512",
      cpu: "256",
      networkMode: ecs.NetworkMode.AWS_VPC,
      compatibility: ecs.Compatibility.MANAGED_INSTANCES,
    });

    taskDefinition.addToExecutionRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [instanceProfile.role!.roleArn],
        actions: ["iam:PassRole"],
      })
    );

    taskDefinition.addContainer("app", {
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, "..", "docker")),
    });

    new ecs.FargateService(this, "app-service", {
      cluster: cluster,
      taskDefinition: taskDefinition,
      minHealthyPercent: 100,
      capacityProviderStrategies: [
        {
          capacityProvider:
            managedInstanceCapacityProvider.capacityProviderName,
          weight: 1,
        },
      ],
    });
  }
}
