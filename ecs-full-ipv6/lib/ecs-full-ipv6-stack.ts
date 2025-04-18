import { aws_ec2 as ec2, aws_ecs as ecs } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
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

    const cluster = new ecs.Cluster(this, "cluster", {
      vpc: vpc,
    });

    const taskDefinition = new ecs.TaskDefinition(this, "task-definition", {
      compatibility: ecs.Compatibility.EC2,
      networkMode: ecs.NetworkMode.BRIDGE,
      cpu: "256",
      memoryMiB: "512",
    });

    const service = new ecs.Ec2Service(this, "service", {
      cluster: cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
    });
  }
}
