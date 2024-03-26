import {
  Route53Client,
  GetDNSSECCommand,
  ChangeResourceRecordSetsCommand,
  GetChangeCommand,
  ChangeStatus,
  KeySigningKey,
} from "@aws-sdk/client-route-53";
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from "aws-lambda";

const handler = async () => {
  const route53Client = new Route53Client({});

  const hostedZoneId = "Z0783675306OVK0GW6SL9";
  const keySigningKeyName = "serviceKsk";

  const dnssecCommandOutput = await route53Client.send(
    new GetDNSSECCommand({
      HostedZoneId: hostedZoneId,
    })
  );
  const filteredKeys = dnssecCommandOutput.KeySigningKeys?.filter(
    (key: KeySigningKey) => key.Name === keySigningKeyName
  );

  if (filteredKeys === undefined || filteredKeys?.length === 0) {
    throw new Error(
      `Key Signed Key for HostedZoneId ${hostedZoneId} was not found.`
    );
  }

  const dsRecord = filteredKeys[0].DSRecord;

  if (dsRecord === undefined) {
    throw new Error(`No DSRecord found for ${keySigningKeyName}`);
  }

  console.log(dsRecord);

  return dsRecord;
};

handler();
