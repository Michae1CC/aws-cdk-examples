import {
  aws_autoscaling as autoscaling,
  aws_ec2 as ec2,
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

const RDS_DATABASE_INSTANCE_PORT: number = 5432;

// Fixed so the CloudWatch log group name is known at synth time and can be created by this stack.
const RDS_DATABASE_INSTANCE_IDENTIFIER: string = "rds-postgres-instance";

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
          // RDS controls SSL via rds.force_ssl (default 1 on PG15+); 0 allows non-SSL connections
          "rds.force_ssl": "0",
          max_connections: "100",
          // Max prepared transaction should be as least as large as max connections,
          //  see: https://www.postgresql.org/docs/current/runtime-config-resource.html#GUC-MAX-PREPARED-TRANSACTIONS
          max_prepared_transactions: "100",
          // Specifies the maximum number of simultaneous autovacuum worker
          // processes that can run at any one time
          autovacuum_max_workers: "1",
          max_locks_per_transaction: "1024",
          // Emit server logs as structured JSON (RDS PostgreSQL 15+)
          log_destination: "jsonlog",
          // Recorded in minutes
          log_rotation_age: "60",
          // Causes the duration of each completed statement to be logged if the statement ran for at least the specified
          // amount of time. Setting to "0" prints all statement durations.
          log_min_duration_statement: "0",
          log_min_messages: "INFO",
          log_min_error_statement: "INFO",
          log_connections: "all",
          log_disconnections: "on",
          log_hostname: "on",
          log_lock_waits: "on",
          log_lock_failures: "on",
          log_temp_files: "0",
          log_autovacuum_min_duration: "0",
          log_error_verbosity: "default",
          // In ms, timeout after 24hrs
          statement_timeout: "86400000",
        },
      },
    );

    // When a log type is listed in cloudwatchLogsExports, RDS publishes it to a log group named
    // /aws/rds/instance/<instance-identifier>/<log-type>. If that group doesn't exist, RDS creates it
    // itself, outside of CloudFormation, with retention set to "never expire" and it is left behind when
    // the stack is deleted.
    // To have this stack own the log group's life cycle (retention and deletion), we create the group
    // up front using the exact name RDS expects, and make the instance depend on it so that CloudFormation
    // creates it first. RDS then writes to the existing group instead of creating its own.
    // See:
    //  - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_LogAccess.Concepts.PostgreSQL.html
    //  - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_LogAccess.Procedural.UploadtoCloudWatch.html
    const postgresqlLogGroup = new logs.LogGroup(this, "postgresql-log-group", {
      logGroupName: `/aws/rds/instance/${RDS_DATABASE_INSTANCE_IDENTIFIER}/postgresql`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.databaseInstance = new rds.DatabaseInstance(
      this,
      "database-instance",
      {
        instanceIdentifier: RDS_DATABASE_INSTANCE_IDENTIFIER,
        engine: rds.DatabaseInstanceEngine.POSTGRES,
        vpc: props.vpc,
        port: RDS_DATABASE_INSTANCE_PORT,
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
        cloudwatchLogsExports: ["postgresql"],
        performanceInsightRetention: rds.PerformanceInsightRetention.MONTHS_15,
        databaseInsightsMode: rds.DatabaseInsightsMode.ADVANCED,
        deleteAutomatedBackups: true,
        monitoringInterval: Duration.minutes(1),
        networkType: rds.NetworkType.IPV4,
        securityGroups: [this.rdsDatabaseInstanceSg],
      },
    );

    // Ensures the log group exists before RDS starts publishing. Otherwise RDS could create an unmanaged
    // group with the same name first, and creating the log group would then fail with "already exists".
    this.databaseInstance.node.addDependency(postgresqlLogGroup);
  }
}
