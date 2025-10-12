import { aws_ec2 as ec2, aws_logs as logs } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  AWS_VPC_IPV4_SUBNET,
  ON_PREM_IPV4_SUBNET,
  ON_PREM_PUBLIC_IP,
} from "./const";

interface VpnStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class VpnStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: VpnStackProps) {
    super(scope, id, props);

    /**
     * Create a log group for the VPN connection
     */
    const vpnConnectionLogGroup = new logs.LogGroup(
      this,
      "vpn-connection-log-group",
      {
        logGroupName: "vpn-connection",
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      }
    );

    /**
     * Create the customer gateway for the on-prem router
     */
    const customerGateway = new ec2.CfnCustomerGateway(
      this,
      "customer-gateway",
      {
        type: "ipsec.1",
        // The customer outside public IP address
        ipAddress: ON_PREM_PUBLIC_IP,
        // A BGP ASN must be set even though we are not using BGP here
        bgpAsn: 65123,
      }
    );

    /**
     * Create the Virtual Private Gateway for the site-to-site VPN connection
     */
    const vpnGateway = new ec2.CfnVPNGateway(this, "vpn-gateway", {
      type: "ipsec.1",
    });

    /**
     * Create an attachment between the Virtual Private Gateway and VPC
     */
    const vpnVpcAttachment = new ec2.CfnVPCGatewayAttachment(
      this,
      "vpc-vpn-attachment",
      {
        vpcId: props.vpc.vpcId,
        vpnGatewayId: vpnGateway.attrVpnGatewayId,
      }
    );

    const vpnConnection = new ec2.CfnVPNConnection(
      this,
      "vpn-connection-on-prem",
      {
        // NOTE: Outside IPs are public IPs used for tunnel setup while inside
        // IPs are used for routing raw data and BGP (not used here)
        type: "ipsec.1",
        // NOTE: Each customer gateway is connected to two different AWS endpoints
        // using a single VPN connection.
        customerGatewayId: customerGateway.attrCustomerGatewayId,
        localIpv4NetworkCidr: ON_PREM_IPV4_SUBNET,
        outsideIpAddressType: "PublicIpv4",
        remoteIpv4NetworkCidr: AWS_VPC_IPV4_SUBNET,
        staticRoutesOnly: true,
        vpnGatewayId: vpnGateway.attrVpnGatewayId,
        // To configure, see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.CfnVPNConnection.VpnTunnelOptionsSpecificationProperty.html
        vpnTunnelOptionsSpecifications: [
          {
            ikeVersions: [
              {
                // Establish phase 1 the IPsec tunnel using the more secure IKEv2 protocol
                value: "ikev2",
              },
            ],
            logOptions: {
              cloudwatchLogOptions: {
                logEnabled: true,
                logGroupArn: vpnConnectionLogGroup.logGroupArn,
                logOutputFormat: "json",
              },
            },
            // IPsec phase 1 configurations
            phase1DhGroupNumbers: [
              {
                value: 14,
              },
            ],
            phase1EncryptionAlgorithms: [
              {
                value: "AES128",
              },
              {
                value: "AES256",
              },
              {
                value: "AES128-GCM-16",
              },
              {
                value: "AES256-GCM-16",
              },
            ],
            phase1IntegrityAlgorithms: [
              {
                value: "SHA1",
              },
              {
                value: "SHA2-256",
              },
              {
                value: "SHA2-384",
              },
              {
                value: "SHA2-512",
              },
            ],
            phase1LifetimeSeconds: 28_800,
            // IPsec phase 2 configurations
            phase2DhGroupNumbers: [
              {
                value: 14,
              },
            ],
            phase2EncryptionAlgorithms: [
              {
                value: "AES128",
              },
              {
                value: "AES256",
              },
              {
                value: "AES128-GCM-16",
              },
              {
                value: "AES256-GCM-16",
              },
            ],
            phase2IntegrityAlgorithms: [
              {
                value: "SHA1",
              },
              {
                value: "SHA2-256",
              },
              {
                value: "SHA2-384",
              },
              {
                value: "SHA2-512",
              },
            ],
            phase2LifetimeSeconds: 3_600,
            // TODO
            preSharedKey: "<TODO>",
          },
        ],
      }
    );

    /**
     * Create a static route to the on-prem network
     */
    new ec2.CfnVPNConnectionRoute(this, "vpn-connection-route-on-prem", {
      destinationCidrBlock: ON_PREM_IPV4_SUBNET,
      vpnConnectionId: vpnConnection.attrVpnConnectionId,
    });

    props.vpc.selectSubnets().subnets.forEach((subnet, index) => {
      new ec2.CfnRoute(this, `vpn-route-${index}`, {
        destinationCidrBlock: ON_PREM_IPV4_SUBNET,
        routeTableId: subnet.routeTable.routeTableId,
        gatewayId: vpnGateway.attrVpnGatewayId,
      });
    });
  }
}
