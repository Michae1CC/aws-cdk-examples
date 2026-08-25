import {
  aws_autoscaling as autoscaling,
  aws_cloudwatch as cloudwatch,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_logs as logs,
  aws_ssm as ssm,
  Duration,
  StackProps,
  RemovalPolicy,
} from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

interface Props extends StackProps {
  vpc: ec2.Vpc;
  amiParameter: ssm.StringParameter;
}

export class NginxClusterStack extends cdk.Stack {
  public readonly nlb: elbv2.NetworkLoadBalancer;
  public readonly nlbTargetGroup: elbv2.NetworkTargetGroup;
  public readonly autoScalingGroup: autoscaling.AutoScalingGroup;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    /**
     * Creates the log group used by the cloudwatch agent for the nginx
     * prometheus exporter. These are do not need to be retained for log
     * since they're only used for creating metrics.
     *
     * NOTE: The `logGroupName` set in the resource should match the
     * `log_group_name` found in the nginx cluster cw agent configuration.
     */
    new logs.LogGroup(this, "nginx-prometheus-exporter", {
      logGroupName: "service/nginx-prometheus-exporter",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /**
     * Creates the log group used by the cloudwatch agent to provide a log
     * group for the agent itself.
     */
    new logs.LogGroup(this, "cloudwatch-agent-logs", {
      logGroupName: "service/amazon-cloudwatch-agent",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /**
     * Creates the log group used by the cloudwatch agent to provide a log
     * group nginx access logs
     */
    new logs.LogGroup(this, "nginx-access-logs", {
      logGroupName: "service/nginx/access",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /**
     * Creates the log group used by the cloudwatch agent to provide a log
     * group nginx error logs
     */
    new logs.LogGroup(this, "nginx-error-logs", {
      logGroupName: "service/nginx/error",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

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
        // Provide the cloudwatch agent with permissions to push to cloudwatch
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
        ec2.InstanceClass.C8GN,
        ec2.InstanceSize.MEDIUM,
      ),
      userData: instanceUserData,
      role: instanceRole,
      securityGroup: instanceSecurityGroup,
      // Enable detailed monitoring so instance metrics are collected at a
      // 1-minute interval instead of the default 5-minute interval.
      detailedMonitoring: true,
      // Enable access to instance tags via IMDS, this is required to query the
      // the ASG name in the user data using the instance metadata service
      instanceMetadataTags: true,
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
        maxCapacity: 5,
        minCapacity: 2,
        deletionProtection: autoscaling.DeletionProtection.NONE,
        updatePolicy: autoscaling.UpdatePolicy.rollingUpdate({
          maxBatchSize: 1,
          minInstancesInService: 2,
          waitOnResourceSignals: true,
        }),
        vpcSubnets: props.vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }),
        signals: autoscaling.Signals.waitForMinCapacity({
          timeout: Duration.minutes(2),
        }),
        // TODO: Investigate ELB health checks
        // Try to get cfn init working
        healthChecks: autoscaling.HealthChecks.withAdditionalChecks({
          gracePeriod: Duration.seconds(300),
          additionalTypes: [autoscaling.AdditionalHealthCheckType.ELB],
        }),
        groupMetrics: [autoscaling.GroupMetrics.all()],
      },
    );

    this.autoScalingGroup = autoScalingGroup;

    /**
     * Target tracking scaling policy that keeps the average CPU utilization
     * across the ASG at 40%.
     */
    autoScalingGroup.scaleOnCpuUtilization("cpu-target-tracking", {
      targetUtilizationPercent: 40,
    });

    /**
     * Target tracking scaling policies that keep the ASG-average network
     * throughput at 1 gigabit per minute for both ingress and egress.
     *
     * NOTE: The `ASGAverageNetworkIn`/`ASGAverageNetworkOut` predefined
     * metrics are reported as total bytes over the collection interval
     * (1 minute), so the target value is expressed as bytes-per-minute:
     * 1 Gb/min = 1,000,000,000 bits / 8 = 125,000,000 bytes.
     */
    autoScalingGroup.scaleOnIncomingBytes("network-in-target-tracking", {
      targetBytesPerSecond: 125_000_000,
    });

    autoScalingGroup.scaleOnOutgoingBytes("network-out-target-tracking", {
      targetBytesPerSecond: 1_000_000,
    });

    const autoScalingGroupDimensionValue = cdk.Fn.select(
      1,
      cdk.Fn.split(
        ":autoScalingGroupName/",
        autoScalingGroup.autoScalingGroupArn,
      ),
    );

    // const nginxConnectionsActiveMetric = new cloudwatch.Metric({
    //   namespace: "Service/NginxStatus",
    //   metricName: "nginx_connections_active",
    //   statistic: "Average",
    //   period: Duration.minutes(1),
    //   dimensionsMap: {
    //     AutoScalingGroupName: autoScalingGroupDimensionValue,
    //   },
    //   label: "Nginx Connection Active Average",
    // });

    const nginxConnectionsActiveMetric = new cloudwatch.MathExpression({
      expression: `SELECT MAX(nginx_connections_active) FROM SCHEMA("Service/NginxStatus", AutoScalingGroupName, InstanceId, InstanceType) WHERE AutoScalingGroupName = '${autoScalingGroupDimensionValue}'`,
      label: "Nginx Connections Active",
      period: Duration.minutes(1),
    });

    autoScalingGroup.scaleOnMetric("nginx-connections-active-scale-policy", {
      metric: nginxConnectionsActiveMetric,
      adjustmentType: autoscaling.AdjustmentType.PERCENT_CHANGE_IN_CAPACITY,
      evaluationPeriods: 3,
      datapointsToAlarm: 3,
      cooldown: cdk.Duration.minutes(3),
      minAdjustmentMagnitude: 1,
      scalingSteps: [
        {
          lower: 0,
          upper: 20,
          change: -25,
        },
        {
          lower: 20,
          upper: 35,
          change: 0,
        },
        {
          lower: 35,
          upper: 70,
          change: 25,
        },
        {
          lower: 70,
          change: 50,
        },
      ],
    });

    // Injects a call to cfn-signal on exit
    instanceUserData.addCommands(
      // Use bash strict mode so the instance cfn signal set at the end of the script is not run if any prior commands fail
      "set -euxo pipefail",
      // Retrieve the instance id and autoscaling group via the metadata service
      'TOKEN=`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`',
      'export INSTANCE_ID=`curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id`',
      'export INSTANCE_TYPE=`curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-type`',
      'export AUTO_SCALING_GROUP_NAME=`curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/tags/instance/aws:autoscaling:groupName`',
      "envsubst '$INSTANCE_ID $INSTANCE_TYPE $AUTO_SCALING_GROUP_NAME' < /opt/aws/amazon-cloudwatch-agent/etc/prometheus.yaml.template > /opt/aws/amazon-cloudwatch-agent/etc/prometheus.yaml",
      // NOTE: The scrape-uri path should match the path in the nginx.conf file where the 'stub_status' configuration is 'on'
      // "systemctl start nginx-prometheus-exporter",
      "/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-agent.json",
      // Wait for cloudwatch agent and prometheus exporter to start
      "sleep 5",
      // Check if the nginx prometheus exporter is running, process names are truncated
      // `if ! pgrep nginx-prometheu >/dev/null; then exit 1; fi`,
      // Check if the cloudwatch agent is running
      // `if [[ $(/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a status | jq .status) != '"running"' ]]; then exit 1; fi`,
    );

    instanceUserData.addSignalOnExitCommand(autoScalingGroup);

    // sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a stop
    // sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a status
    // less /opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log
    // /etc/systemd/system/nginx-prometheus-exporter.service
    // systemctl daemon-reload
    // systemctl enable nginx-prometheus-exporter
    // systemctl start nginx-prometheus-exporter
    // # Validate logrotate without waiting for the timer
    // sudo logrotate -d /etc/logrotate.d/nginx   # dry-run
    // sudo logrotate -f /etc/logrotate.d/nginx   # force once

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

    nlbSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTP);

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
    this.nlbTargetGroup = new elbv2.NetworkTargetGroup(
      this,
      "nginx-cluster-nlb-target-group",
      {
        port: 80,
        protocol: elbv2.Protocol.TCP,
        vpc: props.vpc,
        targetType: elbv2.TargetType.INSTANCE,
        deregistrationDelay: Duration.minutes(1),
        targetGroupHealth: {
          dnsMinimumHealthyTargetCount: 1,
          routingMinimumHealthyTargetCount: 1,
        },
        healthCheck: {
          enabled: true,
          protocol: elbv2.Protocol.HTTP,
          port: "80",
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 3,
          interval: cdk.Duration.seconds(10),
          path: "/healthcheck",
          healthyHttpCodes: "200,202",
        },
      },
    );

    autoScalingGroup.attachToNetworkTargetGroup(this.nlbTargetGroup);

    this.nlb.addListener("nginx-cluster-nlb-listener", {
      port: 80,
      protocol: elbv2.Protocol.TCP,
      defaultTargetGroups: [this.nlbTargetGroup],
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
