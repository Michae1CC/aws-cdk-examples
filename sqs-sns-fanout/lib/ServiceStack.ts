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

    const designUserPassword = new secretsmanager.Secret(this, "userPassword", {
      generateSecretString: {
        includeSpace: false,
        passwordLength: 8,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const designUser = new iam.User(this, "designUser", {
      password: designUserPassword.secretValue,
      passwordResetRequired: false,
    });

    const DESIGN_USER_S3_ACCESS_POINT_NAME = "designUserAccessPoint" as const;
    const designUserAccessPointArn =
      `arn:aws:s3:${this.region}:${this.account}:accesspoint/${DESIGN_USER_S3_ACCESS_POINT_NAME}` as const;

    const designUserAccessPoint = new s3.CfnAccessPoint(
      this,
      "designerAccessPoint",
      {
        bucket: iconsBucket.bucketName,
        policy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AllowDesignUserGetAndPut",
              effect: iam.Effect.ALLOW,
              actions: ["s3:ListObjects", "s3:GetObject", "s3:PutObject"],
              principals: [new iam.ArnPrincipal(designUser.userArn)],
              resources: [`${designUserAccessPointArn}/*`],
            }),
          ],
        }),
      }
    );

    // Delegate access control to the access point
    iconsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "DelegateAccessToAccessPoint",
        effect: iam.Effect.ALLOW,
        actions: ["s3:ListObjects", "s3:GetObject", "s3:PutObject"],
        principals: [new iam.AnyPrincipal()],
        resources: [iconsBucket.bucketArn, iconsBucket.arnForObjects("*")],
        conditions: {
          StringEquals: {
            "s3:DataAccessPointAccount": this.account,
          },
        },
      })
    );
  }
}
