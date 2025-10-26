import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as cloudfront_origins,
  aws_route53 as route53,
  aws_route53_targets as route53_targets,
  aws_s3 as s3,
} from "aws-cdk-lib";

interface DistributionStackProps extends cdk.StackProps {
  hostedZone: route53.IHostedZone;
}

export class DistributionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DistributionStackProps) {
    super(scope, id, props);

    const contentBucket = new s3.Bucket(this, "web-content-bucket", {
      bucketName: "app.michael.polymathian.dev",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Anonymous identities should not be able to view contents
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // Permissions to write log files to the bucket are granted through
      // resource policies. Bucket ACLs are not required.
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    });

    const oac = new cloudfront.S3OriginAccessControl(this, "web-content-oac", {
      signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    });

    const webContentOrigin =
      cloudfront_origins.S3BucketOrigin.withOriginAccessControl(contentBucket, {
        originAccessControl: oac,
      });

    const distributionCertificate = new acm.Certificate(
      this,
      "distribution-certificate",
      {
        domainName: "*.michael.polymathian.dev",
        validation: acm.CertificateValidation.fromDns(props.hostedZone),
      }
    );

    const distribution = new cloudfront.Distribution(this, "distribution", {
      enableLogging: true,
      // The TLS certificate for the custom domain.
      certificate: distributionCertificate,
      defaultRootObject: "index.html",
      domainNames: [
        "app.michael.polymathian.dev",
        "images.michael.polymathian.dev",
      ],
      // We require IPv6 support for customer requests
      enableIpv6: true,
      // TLS 1.0 and 1.1 are deprecated versions (RFC 8996). Use the oldest
      // version of TLS 1.2 which Cloudfront supports.
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      // Enable support for HTTP/2.0. HTTP/1.0 and HTTP/1.1
      // are supported by default.
      httpVersion: cloudfront.HttpVersion.HTTP2,
      defaultBehavior: {
        origin: webContentOrigin,
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
    });

    new route53.ARecord(this, "app-distribution-a-record", {
      zone: props.hostedZone,
      recordName: "app.michael.polymathian.dev",
      target: route53.RecordTarget.fromAlias(
        new route53_targets.CloudFrontTarget(distribution)
      ),
    });

    new route53.AaaaRecord(this, "app-distribution-aaaa-record", {
      zone: props.hostedZone,
      recordName: "app.michael.polymathian.dev",
      target: route53.RecordTarget.fromAlias(
        new route53_targets.CloudFrontTarget(distribution)
      ),
    });

    new route53.ARecord(this, "images-distribution-a-record", {
      zone: props.hostedZone,
      recordName: "images.michael.polymathian.dev",
      target: route53.RecordTarget.fromAlias(
        new route53_targets.CloudFrontTarget(distribution)
      ),
    });

    new route53.AaaaRecord(this, "images-distribution-aaaa-record", {
      zone: props.hostedZone,
      recordName: "images.michael.polymathian.dev",
      target: route53.RecordTarget.fromAlias(
        new route53_targets.CloudFrontTarget(distribution)
      ),
    });
  }
}
