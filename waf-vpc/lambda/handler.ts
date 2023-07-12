import { Handler } from "aws-cdk-lib/aws-lambda";

import { webcrypto } from "crypto";

export const handler: Handler = async (event: unknown, context: unknown) => {
  const passwordLength = 128;
  return { tropofyAdminToken: generatePassword(passwordLength) };
};

/**
 * Creates a secure string password of specfied length
 */
const generatePassword = (length: number): string => {
  const buffer = new Uint8Array(length);
  const array = webcrypto.getRandomValues(buffer);
  // Define the characters that can be used in the password.
  const characters: string =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const password = Array.from(array)
    .map((value) => {
      return characters.charAt(value % characters.length).toString();
    })
    .join("");
  return password;
};
