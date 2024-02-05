import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation } from "@remix-run/react";

export default function Route() {
  const location = useLocation();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  useMemo(async () => {
    const searchParameters = new URLSearchParams(location.hash);
    console.log(location.hash);
    const accessTokenString =
      searchParameters.get("#access_token") ??
      searchParameters.get("access_token");
    setAccessToken(accessTokenString);
    const idTokenString =
      searchParameters.get("#id_token") ?? searchParameters.get("id_token");
    setIdToken(idTokenString);
  }, [location.hash]);

  useEffect(() => {
    if (accessToken !== null && idToken !== null) {
      axios({
        method: "post",
        url: "/access",
        data: {
          accessToken,
          idToken,
        },
      });
    }
  }, [accessToken, idToken]);

  return <Await resolve={async () => {
    if (accessToken !== null && idToken !== null) {
      axios({
        method: "post",
        url: "/access",
        data: {
          accessToken,
          idToken,
        },
      });
    }
  }}>
    {(resolvedValue) => <p>{resolvedValue}</p>}
  </Await>
}
