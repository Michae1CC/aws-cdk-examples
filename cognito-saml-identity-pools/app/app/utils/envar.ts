export const getEnvOrThrow = (name: string) => {
  const value = process.env[name];
  if (value === undefined) {
    console.log(`Could not find envar ${name}`);
  }
  return value!;
};

// export const REGION = getEnvOrThrow("REGION");
// export const ACCOUNT = getEnvOrThrow("ACCOUNT");

// export const TABLE_NAME = getEnvOrThrow("TABLE_NAME");

// export const APP_DOMAIN = getEnvOrThrow("APP_DOMAIN");

// export const IDENTITY_POOL_ID = getEnvOrThrow("IDENTITY_POOL_ID");

// export const USER_POOL_ID = getEnvOrThrow("USER_POOL_ID");
// export const USER_POOL_DOMAIN = getEnvOrThrow("USER_POOL_DOMAIN");
// export const OKTA_APP_CLIENT_ID = getEnvOrThrow("OKTA_APP_CLIENT_ID");
// export const OKTA_ID_PROVIDER_NAME = getEnvOrThrow("OKTA_ID_PROVIDER_NAME");

// export const REGION = "us-east-1";
// export const ACCOUNT = "221318883170";

// export const TABLE_NAME = "DynamoStack-articleTableEEFABD72-9H0A5DFQXK1V";

// export const APP_DOMAIN = "localhost:3000";

// export const IDENTITY_POOL_ID =
//   "us-east-1:66c2b190-bcf0-4077-9825-2e46a8cb1af5";

// export const USER_POOL_ID = "us-east-1_NZwKoasGU";
// export const USER_POOL_DOMAIN =
//   "https://oktasamltestuserpool.auth.us-east-1.amazoncognito.com";
// export const OKTA_APP_CLIENT_ID = "71cpe8n7lsdgfu2mdtalnriej";
// export const OKTA_ID_PROVIDER_NAME = "CognitoStacktityProviderA6699DD5";
