import * as cdk from "aws-cdk-lib";
import {
  aws_elasticloadbalancingv2 as elbv2,
  aws_lambda as lambda,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as sfn_tasks,
  Stack,
  StackProps,
  Duration,
} from "aws-cdk-lib";
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import { Construct } from "constructs";
import { join } from "path";

interface TestStackProps extends StackProps {
  appLoadBalancer: elbv2.ApplicationLoadBalancer;
}

export class TestStack extends Stack {
  public readonly testRunnerStateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: TestStackProps) {
    super(scope, id, props);

    /**
     * Create a lambda that runs api calls to our service that are valid
     */
    const validRequestsRunner = new PythonFunction(
      this,
      "valid-request-tests",
      {
        entry: join(__dirname, "lambdas"),
        index: "valid_requests_lambda.py",
        handler: "handler",
        runtime: lambda.Runtime.PYTHON_3_13,
        timeout: Duration.minutes(2),
        environment: {
          CI: "1",
          APP_ENDPOINT: props.appLoadBalancer.loadBalancerDnsName,
        },
      },
    );

    /**
     * Create a lambda that runs api calls to our service that are invalid
     */
    const invalidRequestsRunner = new PythonFunction(
      this,
      "invalid-request-tests",
      {
        entry: join(__dirname, "lambdas"),
        index: "invalid_requests_lambda.py",
        handler: "handler",
        runtime: lambda.Runtime.PYTHON_3_13,
        timeout: Duration.minutes(2),
        environment: {
          CI: "1",
          APP_ENDPOINT: props.appLoadBalancer.loadBalancerDnsName,
        },
      },
    );

    /**
     * Create a stepfunction task to invoke the valid api calls lambda
     */
    const validRequestsRunnerTask = new sfn_tasks.LambdaInvoke(
      this,
      "validRequestsRunnerTask",
      {
        lambdaFunction: validRequestsRunner,
        resultPath: "$",
        // Ignore any lambda invocation metadata
        payloadResponseOnly: true,
        taskTimeout: sfn.Timeout.duration(cdk.Duration.minutes(2)),
      },
    );

    /**
     * Create a stepfunction task to invoke the invalid api calls lambda
     */
    const invalidRequestsRunnerTask = new sfn_tasks.LambdaInvoke(
      this,
      "invalidRequestsRunnerTask",
      {
        lambdaFunction: invalidRequestsRunner,
        resultPath: "$",
        // Ignore any lambda invocation metadata
        payloadResponseOnly: true,
        taskTimeout: sfn.Timeout.duration(cdk.Duration.minutes(2)),
      },
    );

    const stateMachineDefinition = sfn.Chain.start(
      validRequestsRunnerTask,
    ).next(invalidRequestsRunnerTask);

    /**
     * Create a state machine that runs the test lambdas consecutively
     */
    this.testRunnerStateMachine = new sfn.StateMachine(this, "test-runner", {
      definitionBody: sfn.DefinitionBody.fromChainable(stateMachineDefinition),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
