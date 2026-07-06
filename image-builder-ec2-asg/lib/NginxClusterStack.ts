import {
  aws_autoscaling as autoscaling,
  aws_ec2 as ec2,
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
        maxCapacity: 1,
        minCapacity: 1,
        deletionProtection: autoscaling.DeletionProtection.NONE,
        // By default changing the ASG doesn't actually replace the instances. Repeated for clarity.
        // After deploying a change to this ASG or its dependencies, you need to manually execute
        // an instance replacement.
        updatePolicy: undefined,
        vpcSubnets: props.vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }),
        // signals: ...
        // Try to get cfn init working
        healthChecks: autoscaling.HealthChecks.ec2({
          gracePeriod: Duration.seconds(300),
        }),
      },
    );

    new cdk.CfnOutput(
      this,
      "launch-template-latest-version-command-cfn-output",
      {
        value: `aws ec2 describe-launch-template-versions --region ${this.region} --launch-template-id ${launchTemplate.launchTemplateId} --versions '$Latest'`,
      },
    );
  }
}
