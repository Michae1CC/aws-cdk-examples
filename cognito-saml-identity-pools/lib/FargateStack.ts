import * as cdk from "aws-cdk-lib";
import {
  aws_certificatemanager as acm,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_route53 as route53,
} from "aws-cdk-lib";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { Construct } from "constructs";
import { join } from "path";

interface FargateStackProps extends cdk.StackProps {
  articleTable: dynamodb.Table;
  domainCertificate: acm.Certificate;
  domainName: string;
  hostedZone: route53.IHostedZone;
  userPool: cognito.UserPool;
  userPoolDomainPrefix: string;
  oktaSamlClient: cognito.UserPoolClient;
  oktaSamlIdentityProvider: cognito.UserPoolIdentityProviderSaml;
}

export class FargateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FargateStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "appVpc", {
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "public-subnet",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    const cluster = new ecs.Cluster(this, "appCluster", {
      vpc: vpc,
    });

    const environment: Record<string, string> = {
      // Account envars
      REGION: props.env?.region!,
      ACCOUNT: props.env?.account!,
      // Dynamo envars
      TABLE_NAME: props.articleTable.tableName,
      // DNS envars
      APP_DOMAIN: props.domainName,
      // User pool envars
      USER_POOL_NAME: props.userPool.userPoolProviderName,
      USER_POOL_ID: props.userPool.userPoolId,
      USER_POOL_DOMAIN: `https://${props.userPoolDomainPrefix}.auth.${props.env
        ?.region!}.amazoncognito.com`,
      OKTA_APP_CLIENT_ID: props.oktaSamlClient.userPoolClientId,
      OKTA_ID_PROVIDER_NAME: props.oktaSamlIdentityProvider.providerName,
    };

    const fargateService = new ApplicationLoadBalancedFargateService(
      this,
      "FargateService",
      {
        cluster: cluster,
        cpu: 512,
        desiredCount: 1,
        domainName: props.domainName,
        domainZone: props.hostedZone,
        memoryLimitMiB: 1024,
        certificate: props.domainCertificate,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset(join(__dirname, "..", "./app")),
          containerPort: 3000,
          environment,
          enableLogging: true,
        },
      }
    );

    for (const env in environment) {
      new cdk.CfnOutput(this, env, { value: environment[env] });
    }
  }
}
