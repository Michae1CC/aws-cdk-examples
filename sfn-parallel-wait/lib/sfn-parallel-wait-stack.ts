import {
  aws_dynamodb as dynamodb,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as sfn_tasks,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface Props extends StackProps {}

export class SfnParallelWaitStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const taskTokenTable = new dynamodb.TableV2(this, "task-token-table", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      deletionProtection: false,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      encryption: dynamodb.TableEncryptionV2.dynamoOwnedKey(),
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    const startTask = sfn.Pass.jsonata(this, "task-start-pass-step", {
      outputs: {},
    });

    const initGetItemRetriesTask = sfn.Pass.jsonata(
      this,
      "init-get-item-retries-task",
      {
        assign: {
          getItemRetriesTask: 0,
          parallelTaskSharedId: "{% $states.input.parallelTaskSharedId %}",
        },
      },
    );

    const getTaskTokenTask = sfn_tasks.CallAwsService.jsonata(
      this,
      "get-task-token-task",
      {
        service: "dynamodb",
        action: "getItem",
        parameters: {
          Key: {
            id: {
              S: "{% $parallelTaskSharedId %}",
            },
          },
          TableName: taskTokenTable.tableName,
        },
        iamAction: "dynamodb:getItem",
        iamResources: [taskTokenTable.tableArn],
      },
    );

    const getItemRetryExceededFailTask = sfn.Fail.jsonata(
      this,
      "get-item-retry-exceeded-fail-task",
      {},
    );

    const waitForTaskToken = sfn.Wait.jsonata(this, "wait-task-token-task", {
      time: sfn.WaitTime.duration(Duration.seconds(1)),
      assign: {
        getItemRetriesTask: "{% $getItemRetriesTask + 1 %}",
      },
    });

    const handleParallelPassTask = sfn.Pass.jsonata(
      this,
      "handle-parallel-pass-task",
      {},
    );

    const generateTaskTokenTask = sfn_tasks.CallAwsService.jsonata(
      this,
      "put-task-token-task",
      {
        service: "dynamodb",
        action: "putItem",
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        heartbeatTimeout: undefined,
        parameters: {
          Item: {
            id: {
              S: "{% $states.input.parallelTaskSharedId %}",
            },
            // The dynamodb ttl item must in unix epoch time format at the second granularity.
            // Let each item exist for 1 week.
            ttl: {
              N: "{% $string($floor($millis() / 1000) + (60 * 60 * 24 * 7)) %}",
            },
            taskToken: {
              S: "{% $states.context.Task.Token %}",
            },
          },
          TableName: taskTokenTable.tableName,
        },
        iamAction: "dynamodb:PutItem",
        iamResources: [taskTokenTable.tableArn],
      },
    );

    const sendTaskSuccessTask = sfn_tasks.CallAwsService.jsonata(
      this,
      "send-task-success-task",
      {
        service: "sfn",
        action: "sendTaskSuccess",
        parameters: {
          Output: {
            stsOutput: "helloFromSendTaskSuccess",
          },
          TaskToken: "{% $states.input.Item.taskToken.S %}",
        },
        iamAction: "states:SendTaskSuccess",
        // Use '*' to avoid making a circular reference with the statemachine
        iamResources: ["*"],
      },
    );

    const hasTaskTokenCondition = sfn.Condition.jsonata(
      "{% $exists($states.input.Item) %}",
    );

    const hasExceededMaxGetItemRetriesCondition = sfn.Condition.jsonata(
      "{% $getItemRetriesTask > 10 %}",
    );

    const runDeployBranch = sfn.Chain.start(initGetItemRetriesTask)
      .next(getTaskTokenTask)
      .next(
        sfn.Choice.jsonata(this, "check-get-item-retries-choice", {})
          .when(
            hasExceededMaxGetItemRetriesCondition,
            getItemRetryExceededFailTask,
          )
          .otherwise(
            sfn.Choice.jsonata(this, "check-has-task-token-choice", {})
              .when(hasTaskTokenCondition, sendTaskSuccessTask)
              .otherwise(waitForTaskToken.next(getTaskTokenTask)),
          ),
      );

    const generateTaskTokenBranch = sfn.Chain.start(generateTaskTokenTask);

    const parallelState = sfn.Parallel.jsonata(this, "parallel-task", {
      arguments: {
        parallelTaskSharedId: "{% $uuid() %}",
      },
      outputs: "{% $merge($states.result) %}",
    })
      .branch(runDeployBranch)
      .branch(generateTaskTokenBranch);

    parallelState.addCatch(handleParallelPassTask);

    const finalPassTask = sfn.Pass.jsonata(this, "final-pass-task", {});

    const sfnChain = sfn.Chain.start(startTask)
      .next(parallelState)
      .next(finalPassTask);

    new sfn.StateMachine(this, "state-machine", {
      definitionBody: sfn.DefinitionBody.fromChainable(sfnChain),
      queryLanguage: sfn.QueryLanguage.JSONATA,
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: Duration.minutes(5),
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
