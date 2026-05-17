# syntax=docker/dockerfile:1

FROM --platform=linux/arm64 nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

# Copy the main nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy template instead of final config
COPY default.conf.template /etc/nginx/templates/default.conf.template

RUN envsubst "$(printf '${%s} ' $(env | cut -d'=' -f1))" --variables | xargs -L4 | column -t

EXPOSE 80

CMD ["/bin/sh", "-c", "\
    envsubst '$VPC_LATTICE_SERVICE_DOMAIN_NAME' \
    < /etc/nginx/templates/default.conf.template \
    > /etc/nginx/conf.d/default.conf && \
    nginx -g 'daemon off;' \
    "]
