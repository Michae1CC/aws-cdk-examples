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
