// Import the required AWS SDK for JavaScript v3 modules.
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";

const REGION = "us-east-1";
const ACCOUNT = "221318883170";
const IDENTITY_POOL_ID = "us-east-1:7caadd62-7647-4b8b-86b8-e8bae192eaaf";
const USER_POOL_PROVIDER =
  "cognito-idp.us-east-1.amazonaws.com/us-east-1_2E6fWKuiW";

// Set the default credentials.
const creds = fromCognitoIdentityPool({
  identityPoolId: IDENTITY_POOL_ID,
  clientConfig: { region: REGION },
});
