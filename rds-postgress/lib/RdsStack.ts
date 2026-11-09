import {
  aws_autoscaling as autoscaling,
  aws_ec2 as ec2,
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
  public readonly rdsDatabaseInstanceSg: ec2.SecurityGroup;
  public readonly databaseInstance: rds.DatabaseInstance;
  public readonly templatedSecret: secretsmanager.Secret;

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

    this.rdsDatabaseInstanceSg = new ec2.SecurityGroup(
      this,
      "rds-database-instance-sg",
      {
        vpc: props.vpc,
        allowAllOutbound: true,
      },
    );

    this.templatedSecret = templatedSecret;

    const postgresEngineVersion = rds.PostgresEngineVersion.VER_18_3;

    const pgParameterGroup = new rds.ParameterGroup(
      this,
      "pg-parameter-group",
      {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: postgresEngineVersion,
        }),
        parameters: {
          max_connections: "100",
          // Specifies the maximum number of simultaneous autovacuum worker
          // processes that can run at any one time
          autovacuum_max_workers: "1",
          max_locks_per_transaction: "1024",
          // Recorded in minutes
          log_rotation_age: "60",
          log_min_duration_statement: "0",
          log_connections: "all",
          log_disconnections: "on",
          log_lock_waits: "on",
          log_temp_files: "0",
          log_autovacuum_min_duration: "0",
          log_error_verbosity: "default",
          // In ms, timeout after 24hrs
          statement_timeout: "86400000",
        },
      },
    );

    this.databaseInstance = new rds.DatabaseInstance(
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
        deletionProtection: false,
        enablePerformanceInsights: true,
        removalPolicy: RemovalPolicy.DESTROY,
        parameterGroup: pgParameterGroup,
        // Research
        cloudwatchLogsExports: [],
        performanceInsightRetention: rds.PerformanceInsightRetention.MONTHS_15,
        databaseInsightsMode: rds.DatabaseInsightsMode.ADVANCED,
        deleteAutomatedBackups: true,
        monitoringInterval: Duration.minutes(1),
        networkType: rds.NetworkType.IPV4,
        securityGroups: [this.rdsDatabaseInstanceSg],
      },
    );
  }
}
