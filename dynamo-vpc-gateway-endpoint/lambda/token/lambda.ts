import { APIGatewayProxyHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const clientId = event.queryStringParameters?.["client_id"];
  const clientSecret = event.queryStringParameters?.["client_secret"];
  const code = event.queryStringParameters?.["code"];

  const token = await (
    await fetch(
      `https://github.com/login/oauth/access_token?client_id=${clientId}&client_secret=${clientSecret}&code=${code}`,
      {
        // Setting the accept header to application/json is required to get a json response from github
        // https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github
        headers: {
          accept: "application/json",
        },
        method: "POST",
      }
    )
  ).json();

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(token),
    isBase64Encoded: false,
  };
};
