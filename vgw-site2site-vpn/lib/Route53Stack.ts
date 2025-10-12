import {
  aws_ec2 as ec2,
  aws_route53 as route53,
  aws_route53resolver as route53resolver,
} from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ON_PREM_PRIVATE_DNS_SERVER_IP } from "./const";

interface Route53StackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class Route53Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Route53StackProps) {
    super(scope, id, props);

    const resolverEndpointSg = new ec2.SecurityGroup(
      this,
      "resolver-endpoint-sg",
      {
        vpc: props.vpc,
        allowAllOutbound: true,
      }
    );

    resolverEndpointSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.DNS_TCP,
      "Allow DNS on TCP"
    );

    resolverEndpointSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.DNS_UDP,
      "Allow DNS on UDP"
    );

    resolverEndpointSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allIcmp(),
      "Allow ICMP"
    );

    const dnsResolverInboundEndpoint = new route53resolver.CfnResolverEndpoint(
      this,
      "dns-resolver-inbound-endpoint",
      {
        direction: "INBOUND",
        // Even though the minimum is 1, Route 53 requires that you create at least two,
        // see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53resolver.CfnResolverEndpoint.html#ipaddresses
        ipAddresses: props.vpc.selectSubnets().subnetIds.map((subnetId) => ({
          subnetId: subnetId,
        })),
        securityGroupIds: [resolverEndpointSg.securityGroupId],
        resolverEndpointType: "IPV4",
      }
    );

    const dnsResolverOutboundEndpoint = new route53resolver.CfnResolverEndpoint(
      this,
      "dns-resolver-outbound-endpoint",
      {
        direction: "OUTBOUND",
        // Even though the minimum is 1, Route 53 requires that you create at least two,
        // see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53resolver.CfnResolverEndpoint.html#ipaddresses
        ipAddresses: props.vpc.selectSubnets().subnetIds.map((subnetId) => ({
          subnetId: subnetId,
        })),
        securityGroupIds: [resolverEndpointSg.securityGroupId],
        resolverEndpointType: "IPV4",
      }
    );

    new route53resolver.CfnResolverRule(this, "onprem-resolver-rule", {
      ruleType: "FORWARD",
      domainName: "internal.onprem",
      resolverEndpointId: dnsResolverOutboundEndpoint.logicalId,
      // Requires two IP address, just use the same two
      targetIps: [
        {
          ip: ON_PREM_PRIVATE_DNS_SERVER_IP,
          port: "53",
        },
        {
          ip: ON_PREM_PRIVATE_DNS_SERVER_IP,
          port: "53",
        },
      ],
    });

    const internalAwsVpcHostedZone = new route53.PrivateHostedZone(
      this,
      "internal-awsvpc-hosted-zone",
      {
        vpc: props.vpc,
        zoneName: "internal.awsvpc",
      }
    );

    new route53.ARecord(this, "test-record", {
      zone: internalAwsVpcHostedZone,
      target: route53.RecordTarget.fromIpAddresses("10.0.0.123"),
    });

    // The cast here should be safe since multiple endpoints have been created.
    // (
    //   dnsResolverInboundEndpoint.ipAddresses as route53resolver.CfnResolverEndpoint.IpAddressRequestProperty[]
    // ).forEach((dnsResolverInboundEndpointIpAddress, index) => {
    //   // The IPv4 addresses from this output will need to be configured as
    //   // forwarders for the bind server
    //   new cdk.CfnOutput(
    //     this,
    //     `dns-resolver-inbound-endpoint-ip-address-${index}`,
    //     {
    //       description: "The IPv4 address of a DNS resolver inbound endpoint",
    //       value: dnsResolverInboundEndpointIpAddress.ip!,
    //     }
    //   );
    // });
  }
}
