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
