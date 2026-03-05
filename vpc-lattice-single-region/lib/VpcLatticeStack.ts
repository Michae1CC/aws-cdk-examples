import { aws_vpclattice as vpclattice, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";

interface VpcLatticeStackProps extends StackProps {}

export class VpcLatticeStack extends Stack {
  latticeServiceNetwork: vpclattice.CfnServiceNetwork;

  constructor(scope: Construct, id: string, props: VpcLatticeStackProps) {
    super(scope, id, props);

    // Following: https://docs.aws.amazon.com/vpc-lattice/latest/ug/services.html

    /**
     * see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_vpclattice.CfnServiceNetwork.html
     */
    this.latticeServiceNetwork = new vpclattice.CfnServiceNetwork(
      this,
      "service-network",
      {
        authType: "NONE",
        sharingConfig: {
          enabled: true,
        },
      },
    );
  }
}
