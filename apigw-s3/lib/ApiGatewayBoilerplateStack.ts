import {
  aws_apigateway as apigateway,
  aws_iam as iam,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

/**
 * API Gateway requires a special "ACCOUNT" resource to be created exactly once per account and region.
 * If you don't make it, it will quietly just make one for you in whatever stack first makes an API Gateway resource.
 * To make this behaviour predictable, we create it in this special stack so we know where it will end up
 */
export class ApiGatewayBoilerplateStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // Code taken from CDK RestApiBase._configureCloudWatchRole
    const role = new iam.Role(this, "CloudWatchRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonAPIGatewayPushToCloudWatchLogs"
        ),
      ],
    });
    new apigateway.CfnAccount(this, "Account", {
      cloudWatchRoleArn: role.roleArn,
    });
  }
}
