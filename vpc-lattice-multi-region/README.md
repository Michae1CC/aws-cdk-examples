# VPC Lattice Multi-Region

This example demonstrates how a vpc lattice service may be exposed across
multiple regions.

AWS Private Link does not support cross-region service network endpoints.
To expose a lattice service region cross-region we need to create an
endpoint service which does support cross-region access. However a
endpoint service can only target a NLB which cannot perform DNS
resolution required to forward traffic bound for a lattice service via
a service network vpc association. As a work around, we can point the NLB
at a ECS Nginx cluster which will proxy requests for us.

## Test

Ensure you have created a `.env` in the top level directory with the following
variables.

```env
DOMAIN=<YOUR-R53-HZ-PUBLIC-DOMAIN>
ACCOUNT=<YOUR-OPTIONAL-ACCOUNT-ID>
```

Cloudformation stacks may be deployed with

```bash
cdk bootstrap && cdk deploy --require-approval=never --all
```

Once deployed, you should be able to access the lattice service from the
consumer instance created in the consumer stack.

```text
[ec2-user@ip-10-0-132-198 ~]$ curl -v http://testservice.example.com
*   Trying 10.0.181.166:80...
* Connected to testservice.michael.polymathian.dev (10.0.181.166) port 80
> GET / HTTP/1.1
> Host: testservice.michael.polymathian.dev
> User-Agent: curl/8.3.0
> Accept: */*
> 
< HTTP/1.1 200 OK
< Server: nginx/1.29.8
< Date: Sat, 16 May 2026 04:46:23 GMT
< Content-Type: application/json
< Content-Length: 74
< Connection: keep-alive
< x-amzn-requestid: 33f7995a-a761-48ce-9496-4c52b2bff43b
< x-amzn-remapped-content-length: 0
< x-amz-executed-version: $LATEST
< x-amzn-trace-id: Root=1-6a07f69f-2b21d9204b8470f2294a340c;Parent=38c1aa5aa097858e;Sampled=0;Lineage=1:845ec1e3:0
< 
* Connection #0 to host testservice.example.com left intact
{"message":"Hello from Lambda via VPC Lattice!","path":"/","method":"GET"}
```

## References

* <https://aws.amazon.com/blogs/networking-and-content-delivery/amazon-vpc-vattice-modernize-and-simplify-your-enterprise-network-architectures/>
* <https://repost.aws/articles/ARYLrU69ciTjeXKVmN7G5NMg/centralized-access-to-vpc-private-endpoints-using-vpc-lattice>
* <https://docs.aws.amazon.com/vpc-lattice/latest/ug/service-networks.html>
* <https://docs.aws.amazon.com/vpc/latest/privatelink/access-with-service-network-endpoint.html>
* <https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-access-service-networks.html>
* <https://docs.aws.amazon.com/vpc-lattice/latest/ug/service-custom-domain-name.html>
* <https://docs.aws.amazon.com/vpc-lattice/latest/ug/resource-configuration.html#custom-domain-name-resource-consumers>
* <https://docs.aws.amazon.com/vpc-lattice/latest/ug/service-custom-domain-name.html#dns-associate-custom>
* <https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-vpc-lattice-service.html>
* <https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-ec2-vpcendpoint-dnsoptionsspecification.html>
* <https://docs.aws.amazon.com/vpc-lattice/latest/ug/service-custom-domain-name.html>
* <https://aws.amazon.com/blogs/networking-and-content-delivery/managing-dns-resolution-with-amazon-vpc-lattice-and-vpc-resources/>
* <https://aws.amazon.com/blogs/networking-and-content-delivery/custom-domain-names-for-vpc-lattice-resources/>
* <https://docs.aws.amazon.com/vpc-lattice/latest/APIReference/API_DnsOptions.html>
* <https://github.com/aws/aws-cdk/tree/v1-main/packages/@aws-cdk/custom-resources>
* <https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html>
* <https://aws.amazon.com/solutions/guidance/external-connectivity-to-amazon-vpc-lattice/>
* <https://aws.amazon.com/blogs/networking-and-content-delivery/managing-dns-resolution-with-amazon-vpc-lattice-and-vpc-resources/>
* <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-prefix-eni.html>
* <https://docs.aws.amazon.com/vpc/latest/privatelink/manage-dns-names.html>
