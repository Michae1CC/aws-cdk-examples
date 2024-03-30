# Enabling DNSSEC in Route53 using Cfn Custom Resources

DNSSEC is a security feature of DNS which allows owners of DNS zones to
sign records preventing attacks such as DNS cache poisoning and DNS spoofing.
AWS Route53 allows owners of hosted zones to enable DNSSEC. This can be a little
tricky to do with teams that are managing infrastructure with code since
enabling DNSSEC involves liaising with with top level domains that are outside
the control of AWS. This tutorial outlines a method that keeps as much of the
DNSSEC setup within CDK.

## Creating the Apex Domain and Service Sub-Domain

The following cdk loads in a hosted zone from AWS Route53 hosts the domain used
in this demo. This domain was registered manually through the Route53 console
and is imported into cdk using the `route53.HostedZone.fromLookup` method.

```typescript
this.apexHostedZone = route53.HostedZone.fromLookup(
    this,
    "apexHostedZone",
    {
        domainName: this.domainName,
    }
);
```

We can create a new hosted zone for the service sub-domain easily enough.

```typescript
this.serviceHostedZone = new route53.HostedZone(this, "serviceHostedZone", {
    zoneName: this.subDomainName,
});
```

However we will need new `NS` DNS records in our apex domain to point to our
sub domain so that service domain specific DNS queries are delegated to the
appropriate servers.

```typescript
new route53.NsRecord(this, "serviceNsRecord", {
    zone: this.apexHostedZone,
    recordName: this.subDomainName,
    values: this.serviceHostedZone.hostedZoneNameServers!,
    ttl: cdk.Duration.minutes(5),
});
```

I've pre-emptively lowered each of the zone's maximum to 5mins as a recommendation
from the AWS documentation: <https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-enable-signing.html>.
The idea is to reduce the wait time between enabling signing and and inserting
DS records into the parent zones. It also means you can act more swiftly in the
event of a rollback. The end goal will be to have DNSSEC enabled for both our
apex and service sub-domain.

## Deployment Strategy

* Enable monitoring for DNSSEC failures
* Reduce both zone's maximum TTL [see](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-enable-signing.html#dns-configuring-dnssec-enable-signing-step-1)
* Lower the SOA TTL and SOA minimum field
* Make sure TTL and SOA changes are effective
* Add DNSSEC signing and create KSK via Cloudformation [see](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-enable-signing.html#dns-configuring-dnssec-enable)

- Original min SOA was 86400
- Original CNAME was 900

## References

* <https://learn.cantrill.io/courses/1820301/lectures/43460378>
* <https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-enable-signing.html>
* <https://www.cloudflare.com/dns/dnssec/how-dnssec-works/>
* <https://github.com/GemeenteNijmegen/modules-dnssec-record>
* <https://repost.aws/knowledge-center/create-subdomain-route-53>
* <https://deepdive.codiply.com/enable-dnssec-signing-in-amazon-route-53-using-aws-cdk>
* <https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-custom-domain-names.html>
