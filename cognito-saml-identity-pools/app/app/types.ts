import * as jwtDecode from "jwt-decode";

export type JwtPayload = jwtDecode.JwtPayload & { email: string };

export type AwsAccessKey = {
  AccessKeyId: string;
  SecretAccessKey: string;
};

export type TableItem = {
  id: {
    S: string;
  };
  email: {
    S: string;
  };
  title: {
    S: string;
  };
  body: {
    S: string;
  };
};

export type TableJSObject = {
  id: string;
  email: string;
  title: string;
  body: string;
};

export type EnvironmentVariableKeys =
  | "REGION"
  | "ACCOUNT"
  | "TABLE_NAME"
  | "APP_DOMAIN"
  | "IDENTITY_POOL_ID"
  | "USER_POOL_ID"
  | "USER_POOL_DOMAIN"
  | "OKTA_APP_CLIENT_ID"
  | "OKTA_ID_PROVIDER_NAME";

export type EnvironmentVariables = Record<EnvironmentVariableKeys, string>;
