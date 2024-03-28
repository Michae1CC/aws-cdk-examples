import {
  Route53Client,
  GetDNSSECCommand,
  KeySigningKey,
} from "@aws-sdk/client-route-53";
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from "aws-lambda";

const route53Client = new Route53Client({});

export const getDsRecord = async (
  event: CloudFormationCustomResourceEvent
): Promise<CloudFormationCustomResourceResponse> => {
  const hostedZoneId = event.ResourceProperties.hostedZoneId as string;
  const keySigningKeyName = event.ResourceProperties
    .keySigningKeyName as string;
  // const hostedZoneId = "Z0783675306OVK0GW6SL9";
  // const keySigningKeyName = "serviceKsk";

  const dnssecCommandOutput = await route53Client.send(
    new GetDNSSECCommand({
      HostedZoneId: hostedZoneId,
    })
  );

  const filteredKeys = dnssecCommandOutput.KeySigningKeys?.filter(
    (key: KeySigningKey) => key.Name === keySigningKeyName
  );

  if (filteredKeys === undefined || filteredKeys?.length === 0) {
    return {
      Status: "FAILED",
      Reason: `Key Signing Key for HostedZoneId ${hostedZoneId} was not found.`,
      LogicalResourceId: event.LogicalResourceId,
      PhysicalResourceId: event.ResourceProperties.PhysicalResourceId,
      RequestId: event.RequestId,
      StackId: event.StackId,
    };
  }

  const dsRecordValue = filteredKeys[0].DSRecord;

  if (dsRecordValue === undefined) {
    return {
      Status: "FAILED",
      Reason: `No DSRecord found for ${keySigningKeyName}`,
      LogicalResourceId: event.LogicalResourceId,
      PhysicalResourceId: event.ResourceProperties.PhysicalResourceId,
      RequestId: event.RequestId,
      StackId: event.StackId,
    };
  }

  return {
    Status: "SUCCESS",
    Reason: "",
    Data: {
      dsRecordValue,
    },
    LogicalResourceId: event.LogicalResourceId,
    PhysicalResourceId: event.ResourceProperties.PhysicalResourceId,
    RequestId: event.RequestId,
    StackId: event.StackId,
  };
};

export const handler = async (
  event: CloudFormationCustomResourceEvent
): Promise<CloudFormationCustomResourceResponse> => {
  switch (event.RequestType) {
    case "Create":
      return getDsRecord(event);
    case "Update":
      return getDsRecord(event);
    case "Delete":
      return getDsRecord(event);
  }
};
