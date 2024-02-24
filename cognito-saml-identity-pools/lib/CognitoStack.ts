import * as cdk from "aws-cdk-lib";
import { aws_cognito as cognito } from "aws-cdk-lib";
import { Construct } from "constructs";

interface CognitoStackProps extends cdk.StackProps {
  domainName: string;
}

export class CognitoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: CognitoStackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, "oktaSamlUserPool", {
      userPoolName: "oktaSamlUserPool",
      mfa: cognito.Mfa.OFF,
      selfSignUpEnabled: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    userPool.addDomain("okatSamlUserPoolDomain", {
      cognitoDomain: {
        domainPrefix: "oktasamltestuserpool",
      },
    });

    userPool.addClient("oktaSamlClient", {
      userPoolClientName: "oktaSamlClient",
      generateSecret: true,
      oAuth: {
        callbackUrls: [`https://${props?.domainName}/login`],
        logoutUrls: [`https://${props?.domainName}`],
        flows: {
          // This is not recommend for production settings
          authorizationCodeGrant: false,
          implicitCodeGrant: true,
        },
        // When you authenticate user using the user pool OAuth 2.0
        // authorization server to need to specify the scope of the attributes
        // returned by the server.
        //
        // Here we are allowing all attributes the app client can read.
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
      },
    });

    const oktaSamlIdentityProviderMetadata =
      cognito.UserPoolIdentityProviderSamlMetadata.url(
        "https://dev-npaajtq6i6vncnr2.us.auth0.com/samlp/metadata/EjjqseDMDm7vmlxjRO9AeT8YB7xuHI4e"
      );

    const oktaSamlIdentityProvider = new cognito.UserPoolIdentityProviderSaml(
      this,
      "oktaSamlIdentityProvider",
      {
        userPool,
        metadata: oktaSamlIdentityProviderMetadata,
        idpSignout: true,
        attributeMapping: {
          email: cognito.ProviderAttribute.other("email"),
          familyName: cognito.ProviderAttribute.other("family_name"),
          givenName: cognito.ProviderAttribute.other("given_name"),
          nickname: cognito.ProviderAttribute.other("name"),
        },
      }
    );

    userPool.registerIdentityProvider(oktaSamlIdentityProvider);
  }
}
