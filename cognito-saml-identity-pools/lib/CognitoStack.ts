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

    const oktaSamlIdentityProviderMetadata =
      cognito.UserPoolIdentityProviderSamlMetadata.url(
        "https://dev-npaajtq6i6vncnr2.us.auth0.com/samlp/metadata/EjjqseDMDm7vmlxjRO9AeT8YB7xuHI4e"
      );

    // Chnage 0auth grant types under host sign and sign up pages
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
        // logoutUrls: [`https://${props?.domainName}`],
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
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.custom(
          oktaSamlIdentityProvider.providerName.toString()
        ),
      ],
    });

    userPool.registerIdentityProvider(oktaSamlIdentityProvider);
  }
}

// "logout": {
//   "callback": "https://oktaSamlUserPool.auth.us-east-1.amazoncognito.com/saml2/logout",
//   "slo_enabled": false
// },
// "signingCert": "-----BEGIN CERTIFICATE-----\nMIICvTCCAaWgAwIBAgIJANP+xHTLPK+JMA0GCSqGSIb3DQEBCwUAMB4xHDAaBgNVBAMME3VzLWVhc3QtMV8yRTZmV0t1aVcwHhcNMjQwMjE4MDIwMDA2WhcNMzQwMjE3MTIxMjA2WjAeMRwwGgYDVQQDDBN1cy1lYXN0LTFfMkU2ZldLdWlXMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlMLnWAMqUT/+239DgwpOw7vl0IWXtiTkjpi3FZBL2DqnCYu9+sGRnM4nT1KR/Nuo6nFpZFB+aF9MIDXtVHx/Lkz7hMXF6SqlSnRf2wZaw/nXeRTFOvwgx1z47lFJor8jCDpwVl2ZejeY+hetVBIn0dbuUaBVgU4W8hKZLzjBddUfAduS38HEhP9wao4Fc7kN1RJIsVTR/VBKV4Od0Cr2QtrQqgnG1Jz4wDBELz9agtX17ZaJNbqiYXhe25Sf/thPIlqMY7Wz0/Y64FyroiIDuUkS8xOIAB2+QbsMmNJL3gHlWtd33u9xigOA2UWk8KTcyu6vdyTU+fB20owUqwDBYwIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQAb/Ze23fnIWUXwNHYTC8lMN+gSKE/v0GliVcNNjPp75WCoZL0VY2WsuQypnUQ347uh8hKJgx2ao2eYdP3529Zr1rat7LE+no0inMcDeaBKcIKJnb84puERgItid2xUiEivUAQ6LI0o1yXe5pv2fpkkeg7gLbb3mNgWJcD56QilK6Q5CcKIJC/cRe27161RBrirOWrocngWlqnLxUe1Dr8UchYkL+wdmPtHGjtO0xHfh+qhTX7qj7/aZioPnt2SoUoWznmfeBpFTlnHEst4t2Gpw5NnUBwh+9piZULfk5pAzRodd2zlD9er37cD5LmDxlkmYRomkHAof22m8iXuZw0k\n-----END CERTIFICATE-----",
// "signResponse": true,
