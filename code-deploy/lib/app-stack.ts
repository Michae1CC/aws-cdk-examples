import { aws_ecr as ecr, Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";

export class AppStack extends Stack {
  public readonly appEcrRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.appEcrRepository = new ecr.Repository(this, "app", {
      emptyOnDelete: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
