# Setup bind server

```bash
apt install bind9 bind9utils bind9-doc dnsutils
sudo systemctl start bind9
/etc/init.d/named start
named-checkconf
named-checkzone
```

```text
zone "internal.onprem" {
        type master;
        file "/etc/bind/db.onprem";
};
```

```text
zone "internal.onprem" {
        type master;
        file "/etc/bind/db.onprem";
};
```

```text
$ORIGIN internal.onprem.
$TTL 3600
@       IN      SOA     ns1.internal.onprem. admin.internal.onprem. (
                    2023010101 ; Serial
                    600        ; Refresh
                    600        ; Retry
                    600        ; Expire
                    600 )      ; Minimum TTL
        IN      NS      ns1.internal.onprem.
ns1     IN      A       127.0.0.1
test    IN      A       127.0.0.1
```

## References

* <https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/managing_networking_infrastructure_services/assembly_setting-up-and-configuring-a-bind-dns-server_networking-infrastructure-services>
* <https://docs.aws.amazon.com/vpn/latest/s2svpn/your-cgw.html>
