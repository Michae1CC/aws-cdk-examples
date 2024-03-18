import { aws_route53 as route53 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class Route53 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainName = "awscdkeg.net" as const;
    const subDomainName: `${string}.${typeof domainName}` =
      "service.awscdkeg.net" as const;

    const hostedZone = route53.HostedZone.fromLookup(
      this,
      "awsCdkExampleHostedZone",
      {
        domainName,
      }
    );
  }
}
