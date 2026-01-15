import * as cdk from "aws-cdk-lib/core";
import { aws_s3 as s3 } from "aws-cdk-lib";
import { Construct } from "constructs";

export class StaticSiteStack extends cdk.Stack {
  public readonly staticSiteBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Bucket that the static sites are store in.
     */
    this.staticSiteBucket = new s3.Bucket(this, "bucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    });
  }
}
