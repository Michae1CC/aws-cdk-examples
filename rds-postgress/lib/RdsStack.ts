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
