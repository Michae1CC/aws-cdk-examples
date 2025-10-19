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

```text
$ dig internal.awsvpc @10.0.60.146

; <<>> DiG 9.18.33-1~deb12u2-Debian <<>> internal.awsvpc @10.0.60.146
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 3046
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 1232
;; QUESTION SECTION:
;internal.awsvpc.		IN	A

;; ANSWER SECTION:
internal.awsvpc.	1800	IN	A	10.0.51.217

;; Query time: 16 msec
;; SERVER: 10.0.60.146#53(10.0.60.146) (UDP)
;; WHEN: Sun Oct 19 21:47:48 AEST 2025
;; MSG SIZE  rcvd: 60
```

```text
ec2-user@ip-10-0-51-217 ~]$ ping node2.internal.onprem
PING node2.internal.onprem (192.168.3.145) 56(84) bytes of data.
64 bytes from ip-192-168-3-145.ap-southeast-2.compute.internal (192.168.3.145): icmp_seq=1 ttl=63 time=14.7 ms
64 bytes from ip-192-168-3-145.ap-southeast-2.compute.internal (192.168.3.145): icmp_seq=2 ttl=63 time=14.3 ms
64 bytes from ip-192-168-3-145.ap-southeast-2.compute.internal (192.168.3.145): icmp_seq=3 ttl=63 time=14.4 ms
64 bytes from ip-192-168-3-145.ap-southeast-2.compute.internal (192.168.3.145): icmp_seq=4 ttl=63 time=14.1 ms
^C
--- node2.internal.onprem ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3004ms
rtt min/avg/max/mdev = 14.110/14.377/14.665/0.202 ms
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
