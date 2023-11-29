import * as cdk from "aws-cdk-lib";
import {
  aws_route53 as route53,
  aws_certificatemanager as acm,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class ElbPassThroughStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Global resources

    const domainName = "michaelciccotostocampawscdkexample.com";

    // Create route 53 resources.

    /**
     * Start by created a Route53 hosted zone. This is a DNS DB for a domain
     * consisting of zone file hosted on four name servers provided by DNS.
     *
     * Route53 in this case will double as our domain registrar as well as
     * our hosting provider.
     */
    const hostedZone = new route53.HostedZone(this, "awscdkexamplehostedzone", {
      zoneName: domainName,
      // keep the vpc empty since we would like to keep this as a public
      // hosted zone
    });

    // Create certificate manager resources

    const domainCertificate = new acm.Certificate(this, "exampleCertificate", {
      domainName: domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // Outputs

    new cdk.CfnOutput(this, "hostedzoneNs", {
      value: this.toJsonString(hostedZone.hostedZoneNameServers!),
      description: "NS records for the domain",
    });
  }
}
