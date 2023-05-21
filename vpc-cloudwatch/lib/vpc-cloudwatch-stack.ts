import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Role,
  PolicyStatement,
  Effect,
  ServicePrincipal,
  ArnPrincipal,
} from "aws-cdk-lib/aws-iam";
import {
  Vpc,
  SubnetType,
  Peer,
  Port,
  Instance,
  InstanceType,
  InstanceClass,
  InstanceSize,
  MachineImage,
  AmazonLinuxGeneration,
  SecurityGroup,
  FlowLog,
  FlowLogResourceType,
  FlowLogDestination,
  FlowLogTrafficType,
  FlowLogMaxAggregationInterval,
} from "aws-cdk-lib/aws-ec2";
import { LogGroup } from "aws-cdk-lib/aws-logs";

export class VpcCloudwatchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // IAM policies
    const cloudwatchPublishPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
      ],
      resources: ["*"],
    });
    const cloudwatchPublishRole = new Role(this, "CloudWatchPublishRole", {
      assumedBy: new ServicePrincipal("vpc-flow-logs.amazonaws.com"),
    });
    cloudwatchPublishRole.addToPolicy(cloudwatchPublishPolicy);

    const userPermissionsPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["iam:PassRole"],
      resources: [cloudwatchPublishRole.roleArn],
    });
    const userPermissionsRole = new Role(this, "CloudWatchUserRole", {
      assumedBy: new ArnPrincipal(`arn:aws:iam::${this.account}:root`),
    });
    userPermissionsRole.addToPolicy(userPermissionsPolicy);

    // EC2
    const vpc = new Vpc(this, "Vpc", {
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "public-subnet",
          subnetType: SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    const securityGroup = new SecurityGroup(this, "InstanceSecurityGroup", {
      vpc: vpc,
      allowAllOutbound: true,
      securityGroupName: "instance-security-group",
    });

    securityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.icmpPing(),
      "Allow Pings from Ipv4"
    );

    securityGroup.addIngressRule(
      Peer.anyIpv6(),
      Port.icmpPing(),
      "Allow Pings from Ipv6"
    );

    const instance = new Instance(this, "Instance", {
      vpc: vpc,
      securityGroup: securityGroup,
      instanceName: "instance",
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
      machineImage: MachineImage.latestAmazonLinux({
        generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
    });

    // FlowLogs
    const cloudWatchLogGroup = new LogGroup(this, "CloudWatchLogGroup");
    new FlowLog(this, "FlowLog", {
      resourceType: FlowLogResourceType.fromVpc(vpc),
      destination: FlowLogDestination.toCloudWatchLogs(
        cloudWatchLogGroup,
        cloudwatchPublishRole
      ),
      maxAggregationInterval: FlowLogMaxAggregationInterval.ONE_MINUTE,
      trafficType: FlowLogTrafficType.ACCEPT,
    });

    // Output the public Ip address of the ec2 instance
    new cdk.CfnOutput(this, "InstanceOutput", {
      value: instance.instancePublicIp,
      description: "The public IP of our example instance",
    });
  }
}
