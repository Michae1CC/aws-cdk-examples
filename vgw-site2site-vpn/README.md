# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

```text
$ ping 10.0.51.217
PING 10.0.51.217 (10.0.51.217) 56(84) bytes of data.
64 bytes from 10.0.51.217: icmp_seq=1 ttl=126 time=14.7 ms
64 bytes from 10.0.51.217: icmp_seq=2 ttl=126 time=14.7 ms
64 bytes from 10.0.51.217: icmp_seq=3 ttl=126 time=14.3 ms
```

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## References

* <https://docs.aws.amazon.com/vpn/latest/s2svpn/your-cgw.html>
* <https://aws.amazon.com/blogs/containers/building-an-amazon-ecs-anywhere-home-lab-with-amazon-vpc-network-connectivity/>
* <https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html>
* <https://www.youtube.com/watch?v=y0rjxXnf1Tk>
* <https://www.youtube.com/watch?v=ymzqUTczkzM>
* <https://www.youtube.com/watch?v=Z81Z9HPoVUQ>
* <https://networklessons.com/security/ipsec-internet-protocol-security>
* <https://docs.aws.amazon.com/directconnect/latest/UserGuide/create-virtual-private-gateway.html>
* <https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.CfnVPNGateway.html>
* <https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.CfnVPNConnection.html>
