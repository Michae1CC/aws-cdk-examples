import * as cdk from "aws-cdk-lib";
import {
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
} from "aws-cdk-lib";
import {
  IdentityPool,
  UserPoolAuthenticationProvider,
} from "@aws-cdk/aws-cognito-identitypool-alpha";
import { Construct } from "constructs";

interface CognitoStackProps extends cdk.StackProps {
  domainName: string;
  articleTable: dynamodb.Table;
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolDomainPrefix: string = "oktasamltestuserpool";
  public readonly oktaSamlClient: cognito.UserPoolClient;
  public readonly oktaSamlIdentityProvider: cognito.UserPoolIdentityProviderSaml;
  public readonly identityPool: IdentityPool;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    // *************************************************************************
    // Create resources for user pool
    // *************************************************************************

    this.userPool = new cognito.UserPool(this, "oktaSamlUserPool", {
      userPoolName: "oktaSamlUserPool",
      mfa: cognito.Mfa.OFF,
      selfSignUpEnabled: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const oktaSamlIdentityProviderMetadata =
      cognito.UserPoolIdentityProviderSamlMetadata.url(
        "https://dev-npaajtq6i6vncnr2.us.auth0.com/samlp/metadata/EjjqseDMDm7vmlxjRO9AeT8YB7xuHI4e"
      );

    this.oktaSamlIdentityProvider = new cognito.UserPoolIdentityProviderSaml(
      this,
      "oktaSamlIdentityProvider",
      {
        userPool: this.userPool,
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

    this.userPool.addDomain("okatSamlUserPoolDomain", {
      cognitoDomain: {
        domainPrefix: this.userPoolDomainPrefix,
      },
    });

    this.oktaSamlClient = this.userPool.addClient("oktaSamlClient", {
      userPoolClientName: "oktaSamlClient",
      generateSecret: true,
      oAuth: {
        callbackUrls: [`https://${props?.domainName}/login`],
        // logoutUrls: [`https://${props?.domainName}`],
        flows: {
          // This is not recommended for production settings
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
          this.oktaSamlIdentityProvider.providerName
        ),
      ],
    });

    this.userPool.registerIdentityProvider(this.oktaSamlIdentityProvider);

    // *************************************************************************
    // Create resources for identity pool
    // *************************************************************************

    this.identityPool = new IdentityPool(this, "oktaSamlIdentityPool", {
      // Allow the identity pool to automatically create the authenticated role
      // and guest role since it's difficult to create the trust policies for
      // these roles by hand. We can simply retrieve the automatically created
      // layer and add our own policies to them.
      identityPoolName: "oktaSamlIdentityPool",
      allowUnauthenticatedIdentities: true,
      authenticationProviders: {
        userPools: [
          new UserPoolAuthenticationProvider({
            userPool: this.userPool,
            userPoolClient: this.oktaSamlClient,
            disableServerSideTokenCheck: false,
          }),
        ],
      },
    });

    const getCognitoCredentialsStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ["*"],
      actions: ["cognito-identity:GetCredentialsForIdentity"],
    });

    const unauthenticatedUserStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [props.articleTable.tableArn],
      actions: [
        "dynamodb:BatchGetItem",
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "dynamodb:Query",
      ],
    });

    const authenticatedUserStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [props.articleTable.tableArn],
      actions: [
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:UpdateItem",
      ],
    });

    this.identityPool.authenticatedRole.addManagedPolicy(
      new iam.ManagedPolicy(this, "authenticatedManagedPolicy", {
        statements: [
          getCognitoCredentialsStatement,
          authenticatedUserStatement,
        ],
      })
    );

    this.identityPool.unauthenticatedRole.addManagedPolicy(
      new iam.ManagedPolicy(this, "unauthenticatedManagedPolicy", {
        statements: [
          getCognitoCredentialsStatement,
          unauthenticatedUserStatement,
        ],
      })
    );
  }
}

// "logout": {
//   "callback": "https://oktaSamlUserPool.auth.us-east-1.amazoncognito.com/saml2/logout",
//   "slo_enabled": false
// },
// "signingCert": "-----BEGIN CERTIFICATE-----\nMIICvTCCAaWgAwIBAgIJANP+xHTLPK+JMA0GCSqGSIb3DQEBCwUAMB4xHDAaBgNVBAMME3VzLWVhc3QtMV8yRTZmV0t1aVcwHhcNMjQwMjE4MDIwMDA2WhcNMzQwMjE3MTIxMjA2WjAeMRwwGgYDVQQDDBN1cy1lYXN0LTFfMkU2ZldLdWlXMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlMLnWAMqUT/+239DgwpOw7vl0IWXtiTkjpi3FZBL2DqnCYu9+sGRnM4nT1KR/Nuo6nFpZFB+aF9MIDXtVHx/Lkz7hMXF6SqlSnRf2wZaw/nXeRTFOvwgx1z47lFJor8jCDpwVl2ZejeY+hetVBIn0dbuUaBVgU4W8hKZLzjBddUfAduS38HEhP9wao4Fc7kN1RJIsVTR/VBKV4Od0Cr2QtrQqgnG1Jz4wDBELz9agtX17ZaJNbqiYXhe25Sf/thPIlqMY7Wz0/Y64FyroiIDuUkS8xOIAB2+QbsMmNJL3gHlWtd33u9xigOA2UWk8KTcyu6vdyTU+fB20owUqwDBYwIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQAb/Ze23fnIWUXwNHYTC8lMN+gSKE/v0GliVcNNjPp75WCoZL0VY2WsuQypnUQ347uh8hKJgx2ao2eYdP3529Zr1rat7LE+no0inMcDeaBKcIKJnb84puERgItid2xUiEivUAQ6LI0o1yXe5pv2fpkkeg7gLbb3mNgWJcD56QilK6Q5CcKIJC/cRe27161RBrirOWrocngWlqnLxUe1Dr8UchYkL+wdmPtHGjtO0xHfh+qhTX7qj7/aZioPnt2SoUoWznmfeBpFTlnHEst4t2Gpw5NnUBwh+9piZULfk5pAzRodd2zlD9er37cD5LmDxlkmYRomkHAof22m8iXuZw0k\n-----END CERTIFICATE-----",
// "signResponse": true,
