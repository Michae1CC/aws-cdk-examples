import { createCookie } from "@remix-run/node";

export const idTokenCookie = createCookie("idToken");
export const accessTokenCookie = createCookie("accessToken");
export const accessKeyIdCookie = createCookie("accessToken");
export const secretAccessKeyCookie = createCookie("accessToken");
