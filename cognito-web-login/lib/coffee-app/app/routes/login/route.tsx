import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { DateTime } from "luxon";
import { useEffect } from "react";

export default function Route() {
  useEffect(() => {
    const searchParameters = new URLSearchParams(location.hash);
    const idTokenString =
      searchParameters.get("#id_token") ??
      searchParameters.get("id_token") ??
      "";
    const accessTokenString =
      searchParameters.get("#access_token") ??
      searchParameters.get("access_token") ??
      "";

    if (idTokenString) {
      const idTokenDecoded = jwtDecode(idTokenString);
      Cookies.set("idToken", idTokenString, {
        expires: DateTime.fromSeconds(idTokenDecoded.exp!).toJSDate(),
      });
    } else {
      window.location.href = "/";
    }

    if (accessTokenString) {
      const accessToken = jwtDecode(accessTokenString);
      Cookies.set("accessToken", accessTokenString, {
        expires: DateTime.fromSeconds(accessToken.exp!).toJSDate(),
      });
    }

    window.location.href = "/";
  });
}
