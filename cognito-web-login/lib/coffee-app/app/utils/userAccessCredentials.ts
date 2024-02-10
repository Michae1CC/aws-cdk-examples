import {
  CognitoIdentityClient,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from "@aws-sdk/client-cognito-identity";

const REGION = "us-east-1";
const ACCOUNT = "221318883170";
const IDENTITY_POOL_ID = "us-east-1:7caadd62-7647-4b8b-86b8-e8bae192eaaf";
const USER_POOL_PROVIDER =
  "cognito-idp.us-east-1.amazonaws.com/us-east-1_2E6fWKuiW";

export const getAccessKeys = async (idToken: string): Promise<void> => {
  try {
    console.log("Got to get access keys");
    console.log(idToken);
    console.log("Creating client");
    const cognitoIdentityClient = new CognitoIdentityClient({
      region: REGION,
    });
    let logins: Record<string, string> = {};
    logins[USER_POOL_PROVIDER] = idToken;
    const command = new GetIdCommand({
      AccountId: ACCOUNT,
      IdentityPoolId: IDENTITY_POOL_ID,
      Logins: logins,
    });
    const response = await cognitoIdentityClient.send(command);
    console.log(response);
    const identityId = response.IdentityId;
    if (identityId === undefined) {
      return;
    }
    console.log(identityId);
    const getCredentialsForIdentityCommand =
      new GetCredentialsForIdentityCommand({
        IdentityId: identityId,
        Logins: logins,
      });
    const response2 = await cognitoIdentityClient.send(
      getCredentialsForIdentityCommand
    );
    console.log(response2.Credentials);
  } catch (error) {
    console.log("Failed");
    console.log(error);
  }
};
