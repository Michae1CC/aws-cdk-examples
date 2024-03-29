import * as cdk from "aws-cdk-lib";
import { aws_route53 as route53 } from "aws-cdk-lib";
import { Construct } from "constructs";

import { DsRecordValue } from "./ds-custom-resource";

interface DnssecStackProps extends cdk.StackProps {
  subDomainName: string;
  apexHostedZone: route53.IHostedZone;
  serviceHostedZone: route53.IHostedZone;
  serviceKsk: route53.CfnKeySigningKey;
}

export class DnssecStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DnssecStackProps) {
    super(scope, id, props);

    const serviceDsRecordValue = new DsRecordValue(
      this,
      "serviceDsRecordValue",
      {
        hostedZone: props.serviceHostedZone,
        keySigningKeyName: props.serviceKsk.name,
      }
    );

    new cdk.CfnOutput(this, "serviceDsRecordValueOutput", {
      value: serviceDsRecordValue.dsRecordValue,
    });

    new route53.DsRecord(this, "serviceDsRecord", {
      zone: props.apexHostedZone,
      recordName: props.subDomainName,
      values: [serviceDsRecordValue.dsRecordValue],
      ttl: cdk.Duration.minutes(5),
    });
  }
}
