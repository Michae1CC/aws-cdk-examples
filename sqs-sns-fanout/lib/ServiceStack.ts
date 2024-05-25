import * as cdk from "aws-cdk-lib";
import {
  aws_iam as iam,
  aws_s3 as s3,
  aws_secretsmanager as secretsmanager,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class ServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const iconsBucket = new s3.Bucket(this, "iconsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPassword = new secretsmanager.Secret(this, "userPassword", {
      generateSecretString: {
        includeSpace: false,
        passwordLength: 8,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const designerUser = new iam.User(this, "designerUser", {
      password: userPassword.secretValue,
      passwordResetRequired: false,
    });
  }
}
