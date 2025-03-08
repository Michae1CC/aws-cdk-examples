# Advanced Networking Specialty Exercises

While studying for my AWS ANS C01 certification, I stumbled across
[this post](https://dev.to/aws-builders/aws-advanced-networking-specialty-15-hands-on-exercises-for-certification-success-4eh7)
by Arpad Toth list a number of practical exercises aimed at those studying for
this particular certification. Throwing down the gauntlet, I've decided to take
up the challenge by completing the exercises using CDK. I've omitted exercises
that require multiple accounts or the need to purchase a domain name.

## Exercises 1-4

This is the architecture we will need to implement.

![ex-1-4-architecture](./img/ans-c01-ex-1-4.png)

The architecture of exercises 1-4 have been implement in AWS CDK within the stack
named `"Ex1-4Stack"`.

I created two instances from the console and SSHed into then via the Instance
Connect Endpoints created in CDK. We can indeed connect to KMS from VPC B shown
by running the aws kms list-keys command from ec2 instance in VPC B.

```text
[ec2-user@ip-10-0-95-181 ~]$ aws kms list-keys
{
    "Keys": [
        {
            "KeyId": "518efc3e-d0e3-4a62-8356-acefdb91cc7d",
            "KeyArn": "arn:aws:kms:us-east-1:202533509701:key/518efc3e-d0e3-4a62-8356-acefdb91cc7d"
        },
        ...
    ]
}
```

Attempting to call the same command on our ec2 instance from VPC A causes the
command to hang. This is because creates private DNS records to point to ENI/s
created for the interface endpoint. These private DNS records won't automatically
propagate from VPC B to VPC A. This is shown by running the `dig` command on
`kms.us-east-1.amazonaws.com` VPC A and VPB B respectively. Note that the
domain resolves to the public endpoint for VPC A.

```text
[ec2-user@ip-10-0-95-181 ~]$ dig kms.us-east-1.amazonaws.com

; <<>> DiG 9.18.33 <<>> kms.us-east-1.amazonaws.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 15307
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;kms.us-east-1.amazonaws.com.   IN      A

;; ANSWER SECTION:
kms.us-east-1.amazonaws.com. 52 IN      A       67.220.241.181

;; Query time: 0 msec
;; SERVER: 10.0.0.2#53(10.0.0.2) (UDP)
;; WHEN: Fri Feb 28 12:47:00 UTC 2025
;; MSG SIZE  rcvd: 72
```

```text
[ec2-user@ip-10-1-167-200 ~]$ dig kms.us-east-1.amazonaws.com

; <<>> DiG 9.18.33 <<>> kms.us-east-1.amazonaws.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 17377
;; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;kms.us-east-1.amazonaws.com.   IN      A

;; ANSWER SECTION:
kms.us-east-1.amazonaws.com. 60 IN      A       10.1.58.47
kms.us-east-1.amazonaws.com. 60 IN      A       10.1.139.164

;; Query time: 0 msec
;; SERVER: 10.1.0.2#53(10.1.0.2) (UDP)
;; WHEN: Fri Feb 28 12:46:42 UTC 2025
;; MSG SIZE  rcvd: 88
```

To answer the question

> VPC A has a CIDR block of 10.0.0.0/16. VPC B's CIDR block is 10.0.0.0/20
> with a secondary CIDR of 10.1.0.0/16. Can we peer VPC A and VPC B?

The AWS VPC peer documentation states

> You cannot create a VPC peering connection between VPCs that have matching or
> overlapping IPv4 or IPv6 CIDR blocks.

To put it simply - no.

## Exercise 8

This is the architecture we will need to implement.

![ex-1-4-architecture](./img/ans-c01-ex-8.png)

The architecture of exercises 1-4 have been implement in AWS CDK within the
`"Ex8-P1Tgw1Stack"`, `"Ex8-P1Tgw2Stack"` and `"Ex8-P2Stack"` stacks.

The stacks `"Ex8-P1Tgw1Stack"`, `"Ex8-P1Tgw2Stack"` should be deployed first
with `"Ex8-P2Stack"` being deployed after once the transit gateways latter two
stack become available. You will also need to replace peered transit gateway id
filler text in the `"Ex8-P2Stack"` peering connection with the actual id
generated.

Once the `"Ex8-P2Stack"` has deployed, you will need to create static routes in
each of the default transit gateways targeting the peering connections with the
other VPCs CIDR as the routing CIDR. This is an example of what creating the
static route for the `us-east-1` default transit gateway route table might
look like.

![ex-8-architecture](./img/tgw-static-route.png)

Once deployed create instances in the two VPCs created from these stacks in the
console. SSH onto the instance in `us-east-1`, you should be able to ping the
private Ipv4 address of the instance in `us-east-2`.

```text
[ec2-user@ip-10-0-70-63 ~]$ ping 10.1.214.195
PING 10.1.214.195 (10.1.214.195) 56(84) bytes of data.
64 bytes from 10.1.214.195: icmp_seq=1 ttl=124 time=16.6 ms
64 bytes from 10.1.214.195: icmp_seq=2 ttl=124 time=11.8 ms
64 bytes from 10.1.214.195: icmp_seq=3 ttl=124 time=12.0 ms
64 bytes from 10.1.214.195: icmp_seq=4 ttl=124 time=11.3 ms
^C
--- 10.1.214.195 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 11.287/12.907/16.599/2.146 ms
```

Creating a view for the network in Network Manager was accomplished by following
the steps from
[this post](https://aws.amazon.com/blogs/networking-and-content-delivery/how-to-use-aws-network-manager-to-visualize-transit-gateways-across-all-accounts-in-the-aws-organization/).

![nm-tg-1](./img/nm-tgw-1.png)
![nm-tg-2](./img/nm-tgw-2.png)

## References

* <https://dev.to/aws-builders/aws-advanced-networking-specialty-15-hands-on-exercises-for-certification-success-4eh7>
* <https://docs.aws.amazon.com/vpc/latest/privatelink/create-endpoint-service.html>
* <https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-share-your-services.html>
* <https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-basics.html#vpc-peering-limitations>
* <https://docs.aws.amazon.com/vpc/latest/tgw/how-transit-gateways-work.html>
* <https://github.com/aws-samples/aws-cdk-transit-gateway-peering/tree/master>
* <https://aws.amazon.com/blogs/networking-and-content-delivery/how-to-use-aws-network-manager-to-visualize-transit-gateways-across-all-accounts-in-the-aws-organization/>
