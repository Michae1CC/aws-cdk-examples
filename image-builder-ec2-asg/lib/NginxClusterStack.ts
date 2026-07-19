import {
  aws_autoscaling as autoscaling,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_ssm as ssm,
  Duration,
  StackProps,
} from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

interface Props extends StackProps {
  vpc: ec2.Vpc;
  amiParameter: ssm.StringParameter;
}

export class NginxClusterStack extends cdk.Stack {
  public readonly nlb: elbv2.NetworkLoadBalancer;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const instanceSecurityGroup = new ec2.SecurityGroup(
      this,
      "monitor-instance-sg",
      {
        vpc: props.vpc,
        securityGroupName: "nginx-cluster-security-group",
        allowAllOutbound: true,
      },
    );

    instanceSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
    );
    instanceSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTP);
    instanceSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTPS);

    /**
     * Role for the ec2 instances in the ASG
     */
    const instanceRole = new iam.Role(this, "instance-role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore",
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "CloudWatchAgentServerPolicy",
        ),
      ],
    });

    const instanceUserData = ec2.UserData.forLinux();

    /**
     * Create a launch template that is updated by image builder every time
     * a new AMI is created.
     */
    const launchTemplate = new ec2.LaunchTemplate(this, "launch-template", {
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.M6G,
        ec2.InstanceSize.MEDIUM,
      ),
      userData: instanceUserData,
      role: instanceRole,
      securityGroup: instanceSecurityGroup,
      requireImdsv2: true,
      machineImage: ec2.MachineImage.resolveSsmParameterAtLaunch(
        props.amiParameter.parameterArn,
      ),
    });

    const autoScalingGroup = new autoscaling.AutoScalingGroup(
      this,
      "nginx-cluster-asg",
      {
        vpc: props.vpc,
        launchTemplate: launchTemplate,
        allowAllOutbound: false,
        // desiredCapacity is set to minimum if omitted https://github.com/aws/aws-cdk/issues/5215
        maxCapacity: 5,
        minCapacity: 2,
        deletionProtection: autoscaling.DeletionProtection.NONE,
        updatePolicy: autoscaling.UpdatePolicy.rollingUpdate({
          minInstancesInService: 2,
          waitOnResourceSignals: true,
        }),
        vpcSubnets: props.vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }),
        signals: autoscaling.Signals.waitForMinCapacity({
          timeout: Duration.minutes(2),
        }),
        // Try to get cfn init working
        healthChecks: autoscaling.HealthChecks.ec2({
          gracePeriod: Duration.seconds(300),
        }),
      },
    );

    // Injects a call to cfn-signal on exit
    instanceUserData.addSignalOnExitCommand(autoScalingGroup);

    // The security group used for the cloudfront vpc origin must allow incoming traffic
    // from the AWS managed region specific Cloudfront origin facing prefix list,
    // see:
    //  https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-vpc-origins.html#vpc-origin-prerequisites
    //  https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/LocationsOfEdgeServers.html#managed-prefix-list
    const cloudfrontOriginFacingPrefixList = ec2.PrefixList.fromLookup(
      this,
      "cloudfront-origin-facing-prefix-list",
      {
        prefixListName: "com.amazonaws.global.cloudfront.origin-facing",
      },
    );

    const nlbSg = new ec2.SecurityGroup(this, "nlb-sg", {
      vpc: props.vpc,
      allowAllOutbound: true,
    });

    nlbSg.addIngressRule(
      ec2.Peer.prefixList(cloudfrontOriginFacingPrefixList.prefixListId),
      ec2.Port.HTTP,
    );

    nlbSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow ICMP pings on Ipv4 from anywhere",
    );

    this.nlb = new elbv2.NetworkLoadBalancer(this, "nginx-cluster-nlb", {
      vpc: props.vpc,
      internetFacing: false,
      ipAddressType: elbv2.IpAddressType.IPV4,
      securityGroups: [nlbSg],
      vpcSubnets: props.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
    });

    // Create target group for the Auto Scaling Group
    const targetGroup = new elbv2.NetworkTargetGroup(
      this,
      "nginx-cluster-nlb-target-group",
      {
        port: 80,
        protocol: elbv2.Protocol.TCP,
        vpc: props.vpc,
        targetType: elbv2.TargetType.INSTANCE,
        healthCheck: {
          enabled: true,
          protocol: elbv2.Protocol.HTTP,
          port: "80",
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 3,
          interval: cdk.Duration.seconds(30),
          path: "/healthcheck",
          healthyHttpCodes: "200,202",
        },
      },
    );

    autoScalingGroup.attachToNetworkTargetGroup(targetGroup);

    this.nlb.addListener("nginx-cluster-nlb-listener", {
      port: 80,
      protocol: elbv2.Protocol.TCP,
      defaultTargetGroups: [targetGroup],
    });

    new cdk.CfnOutput(
      this,
      "launch-template-latest-version-command-cfn-output",
      {
        value: `aws ec2 describe-launch-template-versions --region ${this.region} --launch-template-id ${launchTemplate.launchTemplateId} --versions '$Latest'`,
      },
    );
  }
}
