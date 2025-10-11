#Ude Debian slim latest
FROM debian:bookworm

USER root

#Update & upgrade
RUN apt-get update && apt-get upgrade -y

RUN apt-get update ; \
    apt-get install -y systemd systemd-sysv; \
    apt-get clean ;

#Install needed packages
RUN apt-get install -y vim bind9 bind9utils bind9-doc dnsutils
