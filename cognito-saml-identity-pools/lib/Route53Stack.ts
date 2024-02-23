import * as cdk from "aws-cdk-lib";
import {
  aws_route53 as route53,
  aws_certificatemanager as acm,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class Route53Stack extends cdk.Stack {
  public readonly domainName = "awscdkeg.net";
  public readonly hostedZone: route53.IHostedZone;
  public readonly domainCertificate: acm.Certificate;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Look up the hosted zone created using the registration process
     */
    this.hostedZone = route53.HostedZone.fromLookup(
      this,
      "awscdkexamplehostedzone",
      {
        domainName: this.domainName,
      }
    );

    this.domainCertificate = new acm.Certificate(this, "exampleCertificate", {
      domainName: this.domainName,
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });
  }
}
