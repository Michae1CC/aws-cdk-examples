import dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(".env") });

const getFromEnvironment = (envar: string): string => {
  const value = process.env[envar];
  if (value === undefined) {
    throw new Error(`Could not determine environment variable '${envar}'`);
  }
  return value;
};

export const ON_PREM_PUBLIC_IP = getFromEnvironment("ON_PREM_PUBLIC_IP");
export const ON_PREM_PRIVATE_DNS_SERVER_IP = getFromEnvironment(
  "ON_PREM_PRIVATE_DNS_SERVER_IP"
);
export const ON_PREM_IPV4_SUBNET = getFromEnvironment("ON_PREM_IPV4_SUBNET");
export const AWS_VPC_IPV4_SUBNET = "10.0.0.0/16";
