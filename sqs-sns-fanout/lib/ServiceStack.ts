import * as cdk from "aws-cdk-lib";
import {
  aws_iam as iam,
  aws_s3 as s3,
  aws_s3_notifications as s3_notifications,
  aws_sns as sns,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class ServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const graphicsBucket = new s3.Bucket(this, "graphicsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Delegate access control to the access point
    graphicsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "DelegateAccessToAccessPoint",
        effect: iam.Effect.ALLOW,
        actions: ["*"],
        principals: [new iam.AnyPrincipal()],
        resources: [
          graphicsBucket.bucketArn,
          graphicsBucket.arnForObjects("*"),
        ],
        conditions: {
          StringEquals: {
            "s3:DataAccessPointAccount": this.account,
          },
        },
      })
    );

    const designUser = new iam.User(this, "designUser");

    // Create an access key for our users for cli operations
    new iam.AccessKey(this, "designUserAccessKey", {
      user: designUser,
      status: iam.AccessKeyStatus.ACTIVE,
    });

    const DESIGN_USER_S3_ACCESS_POINT_NAME = "design-ap" as const;
    const designUserAccessPointArn =
      `arn:aws:s3:${this.region}:${this.account}:accesspoint/${DESIGN_USER_S3_ACCESS_POINT_NAME}` as const;

    const accessPointPolicyDocument = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          sid: "AllowDesignUserGetAndPut",
          effect: iam.Effect.ALLOW,
          actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
          principals: [new iam.ArnPrincipal(designUser.userArn)],
          // When specifying the bucket objects in the access point resource
          // policy, the object resource must always be prepended with /object
          resources: [
            designUserAccessPointArn,
            `${designUserAccessPointArn}/object/*`,
          ],
        }),
      ],
    });

    const designUserAccessPoint = new s3.CfnAccessPoint(
      this,
      "designerAccessPoint",
      {
        bucket: graphicsBucket.bucketName,
        name: DESIGN_USER_S3_ACCESS_POINT_NAME,
        policy: accessPointPolicyDocument,
      }
    );

    const newIconsTopic = new sns.Topic(this, "NewIconsTopic");

    graphicsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3_notifications.SnsDestination(newIconsTopic),
      { prefix: "icons/" }
    );
  }
}
