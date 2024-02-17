import * as jwtDecode from "jwt-decode";

export type JwtPayload = jwtDecode.JwtPayload & { email: string };

export type AwsAccessKey = {
  AccessKeyId: string;
  SecretAccessKey: string;
};

export type TableItem = {
  description: {
    S: string;
  };
};

export type TableJSObject = {
  description: string;
};
