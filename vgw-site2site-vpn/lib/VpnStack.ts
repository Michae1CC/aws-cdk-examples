import { aws_ec2 as ec2 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ON_PREM_IPV4_SUBNET, ON_PREM_PUBLIC_IP } from "./const";

interface VpnStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class VpnStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: VpnStackProps) {
    super(scope, id, props);

    /**
     * Create the customer gateway for the on-prem router
     */
    const customerGateway = new ec2.CfnCustomerGateway(
      this,
      "customer-gateway",
      {
        type: "ipsec.1",
        ipAddress: ON_PREM_PUBLIC_IP,
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
        type: "ipsec.1",
        customerGatewayId: customerGateway.attrCustomerGatewayId,
        vpnGatewayId: vpnGateway.attrVpnGatewayId,
        staticRoutesOnly: true,
        vpnTunnelOptionsSpecifications: [
          {
            ikeVersions: [
              {
                value: "ikev2",
              },
            ],
          },
        ],
      }
    );

    new ec2.CfnVPNConnectionRoute(this, "vpn-connection-route-on-prem", {
      destinationCidrBlock: ON_PREM_IPV4_SUBNET,
      vpnConnectionId: vpnConnection.attrVpnConnectionId,
    });

    props.vpc
      .selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      })
      .subnets.forEach((subnet, index) => {
        new ec2.CfnRoute(this, `vpn-route-${index}`, {
          destinationCidrBlock: ON_PREM_IPV4_SUBNET,
          routeTableId: subnet.routeTable.routeTableId,
          gatewayId: vpnGateway.attrVpnGatewayId,
        });
      });
  }
}
