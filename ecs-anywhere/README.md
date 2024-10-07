# ECS Anywhere

## How To Test

First clone the repository

```bash
git clone https://github.com/Michae1CC/aws-cdk-examples
```

and change directory into the `sqs-sns-fanout` folder.

```bash
cd ecs-anywhere
```

Run

```bash
npm install
```

to install the required packages to create our Cloudformation template and then

```bash
cdk bootstrap && cdk deploy
```

Make sure you have docker running during this step.

---
Tip: If you're `podman`, or some other image building client, you can specify
the alternative client for cdk by setting the environment variable `CDK_DOCKER`
to the name of the image building command. In the case for podman

```bash
export CDK_DOCKER=podman
```

---

During the setup you will need to set up the ecs-agent on the on-prem device
for the ecs cluster created within cdk, see:
<https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-anywhere-registration.html>.
Note the device you are installing the agent should not have any existing
IAM credentials setup on it.

Once the deploy has finished, the SQS URL and dynamodb table name should be
displayed as outputs.

```text
EcsAnywhereStack.sqsQueueUrl = <SQS-URL>
EcsAnywhereStack.tableName = <DYNAMODB-TABLE-NAME>
```

A new message to the created SQS can be made using the following `aws` cli
command

```bash
aws sqs send-message --queue-url <SQS-URL> --message-body '{"url":"https://example.com"}'
```

After a minute, the message should be processed by the task running on the
external task and entered into the dynamodb table.

```text
aws dynamodb scan --table-name <DYNAMODB-TABLE-NAME>
{
    "Items": [
        {
            "id": {
                "S": "https://example.com"
            }
        }
    ],
    "Count": 1,
    "ScannedCount": 1,
    "ConsumedCapacity": null
}
```

## Clean Up

First register the instance/s used in the ecs service, see:
<https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-anywhere-deregistration.html>.

After run

```bash
cdk destroy
```

## Resources

* <https://kinsta.com/blog/express-typescript/>
* <https://github.com/aws-samples/aws-xray-sdk-node-sample/blob/master/index.js>
* <https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/manage-on-premises-container-applications-by-setting-up-amazon-ecs-anywhere-with-the-aws-cdk.html>
* <https://www.youtube.com/watch?v=064yDG7Rz80>
* <https://github.com/colinhacks/zod>
* <https://ubuntu.com/tutorials/how-to-install-ubuntu-on-your-raspberry-pi#1-overview>
* <https://github.com/aws-samples/amazon-ecs-anywhere-cdk-samples>
* <https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/manage-on-premises-container-applications-by-setting-up-amazon-ecs-anywhere-with-the-aws-cdk.html>
* <https://aws.amazon.com/blogs/containers/building-an-amazon-ecs-anywhere-home-lab-with-amazon-vpc-network-connectivity/>
* <https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-anywhere.html>
* <https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-placement-strategies.html>
