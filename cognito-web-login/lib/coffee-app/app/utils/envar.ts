const getEnvOrThrow = (name: string) => {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Could not find envar ${name}`);
  }
  return value;
};

// export const REGION = getEnvOrThrow("REGION");
// export const IDENTITY_POOL_ID = getEnvOrThrow("IDENTITY_POOL_ID ");
// export const USER_POOL_PROVIDER = getEnvOrThrow("USER_POOL_PROVIDER");
// export const DYNAMO_TABLE_NAME = getEnvOrThrow("DYNAMO_TABLE_NAME");

export const REGION = "us-east-1";
export const TABLE_NAME = "cognitosamltest1";
export const ACCOUNT = "221318883170";

export const APP_DOMAIN = "localhost:3000";
export const IDENTITY_POOL_ID =
  "us-east-1:7caadd62-7647-4b8b-86b8-e8bae192eaaf";
export const USER_POOL_NAME = "testpoolauth01";
export const USER_POOL_PROVIDER =
  "cognito-idp.us-east-1.amazonaws.com/us-east-1_2E6fWKuiW";
export const OKTA_APP_CLIENT_ID = "508cbe40iour98ka15km5c0uej";
export const OKTA_ID_PROVIDER_NAME = "auth0idp";
