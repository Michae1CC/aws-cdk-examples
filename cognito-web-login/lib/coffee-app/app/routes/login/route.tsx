import { jwtDecode } from "jwt-decode";
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

    console.log(jwtDecode(idTokenString));

    document.cookie = `idToken=${idTokenString};`;
    document.cookie = `accessToken=${accessTokenString};`;
    // window.location.href = "/";
  }, []);
}
