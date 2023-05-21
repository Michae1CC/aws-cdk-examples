# VPC Cloudwatch

This example we look at how to cdk-ify on of aws official vpc tutorials. Within the tutorial, a simple vpc is created where traffic is recorded in flow logs. Here we shall recreate the environment from the aws tutorial, but also add in a ec2 instance which we will setup to allow incoming pings.

## IAM

First let's contend with IAM. I'm mostly just using the policies and roles seen in the aws tutorial. The following policy permits a resource to publish logs to CloudWatch.

```typescript
const cloudwatchPublishPolicy = new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents",
    "logs:DescribeLogGroups",
    "logs:DescribeLogStreams",
    ],
    resources: ["*"],
});
```

We can attach this policy to the following role to allow vpc flow logs to publish to cloudwatch.

```typescript
const cloudwatchPublishRole = new Role(this, "CloudWatchPublishRole", {
    assumedBy: new ServicePrincipal("vpc-flow-logs.amazonaws.com"),
});
cloudwatchPublishRole.addToPolicy(cloudwatchPublishPolicy);
```

## EC2

Next we will create a small vpc to house our ec2 instance. We will only create a single public subnet that exists in two availability zones. I practice you'd probably want a larger vpc with a private subnet as well for backend systems, I'm only keeping things terse for this tutorial.

```typescript
const vpc = new Vpc(this, "Vpc", {
    natGateways: 0,
    maxAzs: 2,
    subnetConfiguration: [
    {
        name: "public-subnet",
        subnetType: SubnetType.PUBLIC,
        cidrMask: 24,
    },
    ],
});
```

Next, let's create a security group and add ping rules only rule for our subnet to ensure only ping traffic is hitting our instances.

```typescript
const securityGroup = new SecurityGroup(this, "InstanceSecurityGroup", {
    vpc: vpc,
    allowAllOutbound: true,
    securityGroupName: "instance-security-group",
});

securityGroup.addIngressRule(
    Peer.anyIpv4(),
    Port.icmpPing(),
    "Allow Pings from Ipv4"
);

securityGroup.addIngressRule(
    Peer.anyIpv6(),
    Port.icmpPing(),
    "Allow Pings from Ipv6"
);
```

Finally its time to create the ec2 instance that we will use to ping. Choosing a t2.micro type allows us to deploy our architecture within a free-tier account (not that we really need anything more meaty considering we are only going to ping this).

```typescript
const instance = new Instance(this, "Instance", {
    vpc: vpc,
    securityGroup: securityGroup,
    instanceName: "instance",
    instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
    machineImage: MachineImage.latestAmazonLinux({
    generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
    }),
});
```

## FlowLog

Setting up our flow logs is fairly straight forward. To start, we need to create a new log group to capture and store traffic data. After we create a flow log itself, providing it with the vpc to monitor, the role for cloud watch permissions, and a log group to point to. I've also set the traffic type to `ACCEPT` only to make it a little easier to find our pings and the max aggregation interval to one minute so we are not waiting as long for our logs to appear.

```typescript
const cloudWatchLogGroup = new LogGroup(this, "CloudWatchLogGroup");
new FlowLog(this, "FlowLog", {
    resourceType: FlowLogResourceType.fromVpc(vpc),
    destination: FlowLogDestination.toCloudWatchLogs(
    cloudWatchLogGroup,
    cloudwatchPublishRole
    ),
    maxAggregationInterval: FlowLogMaxAggregationInterval.ONE_MINUTE,
    trafficType: FlowLogTrafficType.ACCEPT,
});
```

## How To Test

First clone the repository

```bash
git clone https://github.com/Michae1CC/aws-cdk-examples
```

and change directory into the `vpc-cloudwatch` folder.

```bash
cd vpc-cloudwatch
```

Run

```bash
npm install
```

to install the required packages to create our Cloudformation template and them

```bash
cdk bootstrap && cdk deploy
```

You should see an output similar to the following

```
Outputs:
VpcCloudwatchStack.InstanceOutput = <instance-ip>
Stack ARN:
arn:aws:cloudformation:us-east-1: ...
```

We can attempt to ping our instance in the terminal

```
> ping <instance-ip>
PING <instance-ip> (<instance-ip>): 56 data bytes
64 bytes from <instance-ip>: icmp_seq=0 ttl=230 time=241.517 ms
64 bytes from <instance-ip>: icmp_seq=1 ttl=230 time=241.030 ms
64 bytes from <instance-ip>: icmp_seq=2 ttl=230 time=243.368 ms
^C
--- <instance-ip> ping statistics ---
3 packets transmitted, 3 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 241.030/241.972/243.368/1.007 ms

> ping <instance-ip>
PING <instance-ip> (<instance-ip>): 56 data bytes
64 bytes from <instance-ip>: icmp_seq=0 ttl=230 time=241.442 ms
64 bytes from <instance-ip>: icmp_seq=1 ttl=230 time=241.451 ms
64 bytes from <instance-ip>: icmp_seq=2 ttl=230 time=240.731 ms
64 bytes from <instance-ip>: icmp_seq=3 ttl=230 time=240.396 ms
64 bytes from <instance-ip>: icmp_seq=4 ttl=230 time=241.000 ms
64 bytes from <instance-ip>: icmp_seq=5 ttl=230 time=241.140 ms
64 bytes from <instance-ip>: icmp_seq=6 ttl=230 time=240.141 ms
^C
--- <instance-ip> ping statistics ---
7 packets transmitted, 7 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 240.141/240.900/241.451/0.467 ms
```

If you navigate to CloudWatch stream created for the flow logs you should seen entries similar to the following

```
> 2 <accountid> <interface-id> <desk-machine-ip> <subnet-instance-ip> 0 0 1 3 252 1684675923 1684675982 ACCEPT OK

> 2 <accountid> <interface-id> <subnet-instance-ip> <desk-machine-ip> 0 0 1 3 252 1684675923 1684675982 ACCEPT OK

> 2 <accountid> <interface-id> <desk-machine-ip> <subnet-instance-ip> 0 0 1 7 588 1684675987 1684676042 ACCEPT OK

> 2 <accountid> <interface-id> <subnet-instance-ip> <desk-machine-ip> 0 0 1 7 588 1684675987 1684676042 ACCEPT OK
```

For reference, the logs have the following default format

```
[version, accountid, interfaceid, srcaddr, dstaddr, srcport, dstport, protocol, packets, bytes, start, end, action, logstatus]
```

As we can see, the logs align exactly with the pings we made in the terminal. Finally, run the following command to relinquish all the resources allocated in this tutorial.

```
cdk destroy
```

## References

* Special thanks to [Paul Foo](https://www.linkedin.com/in/paul-foo?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAAB3ApeMB0vFLnjbxnS0wYvi5z-Bjod6gy78&lipi=urn%3Ali%3Apage%3Ad_flagship3_search_srp_all%3BGZPwz0UGTZO%2FynTruzx9TA%3D%3Ds) for providing advice on security group set up.
* https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs-cwl.html
* https://dev.to/emmanuelnk/part-3-simple-ec2-instance-awesome-aws-cdk-37ia 
* https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.FlowLog.html#maxaggregationinterval