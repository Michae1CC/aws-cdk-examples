import {
  aws_autoscaling as autoscaling,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_iam as iam,
  aws_logs as logs,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
  Duration,
  Stack,
  StackProps,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface Props extends StackProps {
  vpc: ec2.Vpc;
}

export class RdsStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    // Templated secret with username and password fields
    const templatedSecret = new secretsmanager.Secret(this, "TemplatedSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "postgres" }),
        generateStringKey: "password",
        excludeCharacters: '/@"',
      },
    });

    const rdsDatabaseInstanceSg = new ec2.SecurityGroup(
      this,
      "rds-database-instance-sg",
      {
        vpc: props.vpc,
        allowAllOutbound: true,
      },
    );

    const databaseInstance = new rds.DatabaseInstance(
      this,
      "database-instance",
      {
        engine: rds.DatabaseInstanceEngine.POSTGRES,
        vpc: props.vpc,
        allocatedStorage: 10, // GiB
        allowMajorVersionUpgrade: false,
        autoMinorVersionUpgrade: true,
        credentials: {
          username: templatedSecret
            .secretValueFromJson("username")
            .unsafeUnwrap(),
          password: templatedSecret.secretValueFromJson("password"),
        },
        storageEncrypted: true,
        // Research
        cloudwatchLogsExports: [],
        performanceInsightRetention: rds.PerformanceInsightRetention.MONTHS_15,
        databaseInsightsMode: rds.DatabaseInsightsMode.ADVANCED,
        deleteAutomatedBackups: true,
        monitoringInterval: Duration.minutes(1),
        networkType: rds.NetworkType.IPV4,
        securityGroups: [rdsDatabaseInstanceSg],
      },
    );

    // No inbound rules needed — SSM connects outbound over HTTPS (443).
    const instanceSg = new ec2.SecurityGroup(this, "instance-sg", {
      vpc: props.vpc,
      allowAllOutbound: true, // required for SSM agent to reach SSM endpoints
    });

    /**
     * Role for the ec2 instances in the ASG
     */
    const instanceRole = new iam.Role(this, "ec2-instance-iam-role", {
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

    const userData = ec2.UserData.forLinux({});
    userData.addCommands("dnf update -y", "dnf install postgresql18");

    const instance = new ec2.Instance(this, "instance", {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      // Amazon Linux 2023 ships with SSM Agent pre-installed.
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: instanceSg,
      role,
      // Grants Session Manager permissions and wires up the instance profile.
      ssmSessionPermissions: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      // Require IMDSv2 (security best practice).
      requireImdsv2: true,
    });

    // Allow the instance security group to connect to the database
    rdsDatabaseInstanceSg.addIngressRule(instanceSg, ec2.Port.tcp(5432));

    // Create resource for running pgAdmin
    const ecsCluster = new ecs.Cluster(this, "pgadmin-ecs-cluster", {
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENHANCED,
    });

    const instanceUserData = ec2.UserData.forLinux();
    instanceUserData.addCommands(
      // ECS config https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-agent-config.html
      // https://github.com/aws/amazon-ecs-agent/blob/master/README.md
      "dnf update -y",
      `echo ECS_CLUSTER=${ecsCluster.clusterName} >> /etc/ecs/ecs.config;`,
      "echo ECS_BACKEND_HOST= >> /etc/ecs/ecs.config;",
      // Reserves that memory for critical system processes
      // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/memory-management.html
      "echo ECS_RESERVED_MEMORY=1024 >> /etc/ecs/ecs.config;",
      "echo ECS_IMAGE_PULL_BEHAVIOR=always >> /etc/ecs/ecs.config",
      "dnf install -y amazon-cloudwatch-agent postgresql18",
    );

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
      securityGroup: instanceSg,
      // Enable detailed monitoring so instance metrics are collected at a
      // 1-minute interval instead of the default 5-minute interval.
      detailedMonitoring: true,
      instanceMetadataTags: true,
      requireImdsv2: true,
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
    });

    const pgAdminAsg = new autoscaling.AutoScalingGroup(this, "pgadmin-asg", {
      vpc: props.vpc,
      launchTemplate: launchTemplate,
      allowAllOutbound: false,
      minCapacity: 2,
      maxCapacity: 2,
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
      healthChecks: autoscaling.HealthChecks.withAdditionalChecks({
        gracePeriod: Duration.seconds(300),
        additionalTypes: [autoscaling.AdditionalHealthCheckType.ELB],
      }),
      groupMetrics: [autoscaling.GroupMetrics.all()],
    });

    instanceUserData.addSignalOnExitCommand(pgAdminAsg);

    const pgadminLogGroup = new logs.LogGroup(this, "pgadmin", {
      logGroupName: "pgadmin",
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    const pgAdminTaskDefinition = new ecs.Ec2TaskDefinition(
      this,
      "pgadmin-task-definition",
      {
        networkMode: ecs.NetworkMode.BRIDGE,
        placementConstraints: [ecs.PlacementConstraint.distinctInstances()],
      },
    );

    const pgAdminContainer = pgAdminTaskDefinition.addContainer(
      "pgadmin-container",
      {
        containerName: "pgadmin",
        portMappings: [{ containerPort: 80 }],
        image: ecs.ContainerImage.fromRegistry("dpage/pgadmin4"),
        essential: true,
        // Containers can burst above this limit
        memoryReservationMiB: 512,
        // A hard memory limit imposed on tasks
        memoryLimitMiB: 1024,
        cpu: 256,
        logging: new ecs.AwsLogDriver({
          logGroup: pgadminLogGroup,
          streamPrefix: "ecs",
          mode: ecs.AwsLogDriverMode.NON_BLOCKING,
        }),
      },
    );
  }
}
