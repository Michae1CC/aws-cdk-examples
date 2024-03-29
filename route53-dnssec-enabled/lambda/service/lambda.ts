import { Handler } from "aws-lambda";

export const handler: Handler = async (event) => {
  return {
    statusCode: 200,
    isBase64Encoded: false,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
    body: "<h2>Hello From DNSSEC enabled lambda!<h2/>",
  };
};
