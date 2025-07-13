# Centralizes access using VPC interface endpoints

A CDK implementation of this blog post: <https://aws.amazon.com/blogs/networking-and-content-delivery/centralize-access-using-vpc-interface-endpoints/>.
Note that you will have to manually associate the private hosted zone with the
spoke VPC, since there is no CDK construct to perform at the time of writing.

## References

* <https://aws.amazon.com/blogs/networking-and-content-delivery/centralize-access-using-vpc-interface-endpoints/>
* <https://aws.amazon.com/blogs/networking-and-content-delivery/centralized-dns-management-of-hybrid-cloud-with-amazon-route-53-and-aws-transit-gateway/>
* <https://aws.amazon.com/blogs/security/how-to-centralize-dns-management-in-a-multi-account-environment/>
* <https://aws.amazon.com/blogs/security/simplify-dns-management-in-a-multiaccount-environment-with-route-53-resolver/>
