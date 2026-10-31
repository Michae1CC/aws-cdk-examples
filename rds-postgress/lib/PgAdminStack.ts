import {
  aws_autoscaling as autoscaling,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_logs as logs,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
  Duration,
  Stack,
  StackProps,
  RemovalPolicy,
  Token,
} from "aws-cdk-lib";
import cluster from "cluster";
import { Construct } from "constructs";

interface Props extends StackProps {
  vpc: ec2.Vpc;
  rdsDatabaseInstanceSg: ec2.SecurityGroup;
  databaseInstance: rds.DatabaseInstance;
  templatedSecret: secretsmanager.Secret;
}

export class PgAdminStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    /**
     * Create resource for running pgAdmin
     */
    const ecsCluster = new ecs.Cluster(this, "pgadmin-ecs-cluster", {
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENHANCED,
    });

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

    // Allow the instance security group to connect to the database
    // Defined here (not via addIngressRule) so the rule lives in this stack
    // and rds-stack doesn't depend on pg-admin-stack.
    new ec2.CfnSecurityGroupIngress(this, "rds-ingress-from-instance-sg", {
      groupId: props.rdsDatabaseInstanceSg.securityGroupId,
      sourceSecurityGroupId: instanceSg.securityGroupId,
      ipProtocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
    });

    const instanceUserData = ec2.UserData.forLinux();
    instanceUserData.addCommands(
      // ECS config https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-agent-config.html
      // https://github.com/aws/amazon-ecs-agent/blob/master/README.md
      "dnf update -y",
      `echo ECS_CLUSTER=${ecsCluster.clusterName} >> /etc/ecs/ecs.config;`,
      // Reserves that memory for critical system processes
      // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/memory-management.html
      "echo ECS_RESERVED_MEMORY=1024 >> /etc/ecs/ecs.config;",
      "echo ECS_IMAGE_PULL_BEHAVIOR=always >> /etc/ecs/ecs.config",
      "dnf install -y amazon-cloudwatch-agent postgresql17 aws-cfn-bootstrap",
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
      machineImage: ecs.EcsOptimizedImage.amazonLinux2023(
        ecs.AmiHardwareType.ARM,
      ),
    });

    const pgAdminAsg = new autoscaling.AutoScalingGroup(this, "pgadmin-asg", {
      vpc: props.vpc,
      launchTemplate: launchTemplate,
      allowAllOutbound: true,
      minCapacity: 4,
      maxCapacity: 4,
      deletionProtection: autoscaling.DeletionProtection.NONE,
      healthChecks: autoscaling.HealthChecks.ec2({
        gracePeriod: Duration.seconds(120),
      }),
      updatePolicy: autoscaling.UpdatePolicy.rollingUpdate({
        maxBatchSize: 1,
        minInstancesInService: 1,
        waitOnResourceSignals: true,
      }),
      vpcSubnets: props.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
      signals: autoscaling.Signals.waitForMinCapacity({
        timeout: Duration.minutes(10),
      }),
      groupMetrics: [autoscaling.GroupMetrics.all()],
    });

    instanceUserData.addSignalOnExitCommand(pgAdminAsg);

    ecsCluster.addAsgCapacityProvider(
      new ecs.AsgCapacityProvider(this, "asg-capacity-provider", {
        autoScalingGroup: pgAdminAsg,
        enableManagedScaling: false,
        enableManagedTerminationProtection: false,
        enableManagedDraining: true,
      }),
    );

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
      },
    );

    // Server definition that pgAdmin imports on first start
    const serversJson = this.toJsonString({
      Servers: {
        "1": {
          Name: "rds-postgres",
          Group: "Servers",
          Host: props.databaseInstance.dbInstanceEndpointAddress,
          Port: Token.asNumber(props.databaseInstance.dbInstanceEndpointPort),
          MaintenanceDB: "postgres",
          Username: "postgres",
          SSLMode: "prefer",
          PassFile: "/tmp/pgpass",
        },
      },
    });

    // Write servers.json and a pgpass file (escaping \ and : in the password)
    // before handing off to the stock pgAdmin entrypoint.
    const startupScript = [
      `printf '%s' "$PGADMIN_SERVERS_JSON" > /tmp/servers.json`,
      `ESCAPED_PASSWORD=$(printf '%s' "$DB_PASSWORD" | sed 's/[\\\\:]/\\\\&/g')`,
      `printf '%s:%s:*:%s:%s\\n' "$DB_HOST" "$DB_PORT" "$DB_USER" "$ESCAPED_PASSWORD" > /tmp/pgpass`,
      `chmod 600 /tmp/pgpass`,
      `exec /entrypoint.sh`,
    ].join(" && ");

    const pgAdminContainer = pgAdminTaskDefinition.addContainer(
      "pgadmin-container",
      {
        containerName: "pgadmin",
        portMappings: [{ containerPort: 80 }],
        // Use a pgadmin image version which has pg v18 compatibility
        image: ecs.ContainerImage.fromRegistry("dpage/pgadmin4:latest"),
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
        environment: {
          // See: https://www.pgadmin.org/docs/pgadmin4/latest/container_deployment.html
          PGADMIN_DEFAULT_PASSWORD: props.templatedSecret
            .secretValueFromJson("password")
            .unsafeUnwrap(),
          PGADMIN_CONFIG_WTF_CSRF_CHECK_DEFAULT: "False",
          PGADMIN_CONFIG_WTF_CSRF_ENABLED: "False",
          PGADMIN_DEFAULT_EMAIL: "email@example.com",
          PGADMIN_CONFIG_SERVER_MODE: "False",
          PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED: "False",
          PGADMIN_LISTEN_ADDRESS: "0.0.0.0",
          PGADMIN_LISTEN_PORT: "80",
          PGADMIN_SERVER_JSON_FILE: "/tmp/servers.json",
          PGADMIN_SERVERS_JSON: serversJson,
          DB_HOST: props.databaseInstance.dbInstanceEndpointAddress,
          DB_PORT: props.databaseInstance.dbInstanceEndpointPort,
        },
        secrets: {
          DB_USER: ecs.Secret.fromSecretsManager(
            props.templatedSecret,
            "username",
          ),
          DB_PASSWORD: ecs.Secret.fromSecretsManager(
            props.templatedSecret,
            "password",
          ),
        },
        entryPoint: ["/bin/sh", "-c"],
        command: [startupScript],
      },
    );

    const pgadminService = new ecs.Ec2Service(this, "pgadmin-service", {
      cluster: ecsCluster,
      taskDefinition: pgAdminTaskDefinition,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      availabilityZoneRebalancing: ecs.AvailabilityZoneRebalancing.ENABLED,
      desiredCount: 2,
      placementStrategies: [
        ecs.PlacementStrategy.spreadAcross("attribute:ecs.availability-zone"),
      ],
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, "alb-sg", {
      vpc: props.vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4",
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv6",
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTP,
      "Allow HTTP traffic from Ipv4",
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.HTTP,
      "Allow HTTP from Ipv6",
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTPS,
      "Allow HTTPS traffic from Ipv4",
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.HTTPS,
      "Allow HTTPS from Ipv6",
    );

    albSecurityGroup.addEgressRule(
      instanceSg,
      ec2.Port.tcpRange(32768, 60999),
      "Out to webapp EC2",
    );

    instanceSg.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcpRange(32768, 60999),
      "Requests from ALB",
    );

    const loadBalancer = new elbv2.ApplicationLoadBalancer(
      this,
      "service-alb",
      {
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
        internetFacing: true,
        ipAddressType: elbv2.IpAddressType.IPV4,
        securityGroup: albSecurityGroup,
        http2Enabled: true,
        preserveHostHeader: true,
        dropInvalidHeaderFields: true,
      },
    );

    const pgadminTargetGroup = new elbv2.ApplicationTargetGroup(
      this,
      "webapp-tg",
      {
        vpc: props.vpc,
        protocol: elbv2.ApplicationProtocol.HTTP,
        port: 80,
        // Need a delay long enough to finish requests. We support up to 60 seconds for a single request
        deregistrationDelay: Duration.seconds(60),
        // pgAdmin keeps session/connection state per container, so pin each client to one task
        stickinessCookieDuration: Duration.hours(1),
        healthCheck: {
          protocol: elbv2.Protocol.HTTP,
          path: "/misc/ping",
        },
      },
    );

    pgadminTargetGroup.addTarget(pgadminService);

    const publicAlbHttpListener = loadBalancer.addListener("http-listener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([pgadminTargetGroup]),
    });
  }
}
