ARG ENVOY_VERSION=v1.34.1
FROM --platform=linux/amd64 envoyproxy/envoy:${ENVOY_VERSION}

COPY envoy.yaml /etc/envoy/envoy.yaml

RUN : \
    && envoy --version \
    && envoy --mode validate -c /etc/envoy/envoy.yaml

EXPOSE 10000 9901

CMD ["envoy", "-c", "/etc/envoy/envoy.yaml"]
