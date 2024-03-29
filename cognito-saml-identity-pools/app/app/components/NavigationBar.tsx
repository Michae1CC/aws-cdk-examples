import { useContext, useEffect, useState } from "react";
import { EnvContext, JwtDecodedContext } from "~/utils/context";

export default function NavigationBar() {
  const jwtDecoded = useContext(JwtDecodedContext);
  const env = useContext(EnvContext);

  const [userLoggedIn, setUserLoggedIn] = useState<boolean>(
    jwtDecoded !== undefined
  );

  const loginUrl = `${env.USER_POOL_DOMAIN}/oauth2/authorize?client_id=${
    env.OKTA_APP_CLIENT_ID
  }&response_type=token&scope=email+openid+profile&redirect_uri=${encodeURIComponent(
    `https://${env.APP_DOMAIN}`
  )}/login`;

  const logoutUrl = "/logout";

  console.log("Login URL");
  console.log(loginUrl);

  useEffect(() => {
    setUserLoggedIn(jwtDecoded !== undefined);
  }, [jwtDecoded]);

  return (
    <div className="navbar">
      <div className="nav-elements">
        <ul>
          <li>
            <a href="/">Home</a>
          </li>
          {userLoggedIn && (
            <li>
              <a href="/create">Create</a>
            </li>
          )}
          <li>
            <a href={userLoggedIn ? logoutUrl : loginUrl}>
              {userLoggedIn ? "Logout" : "Login"}
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
