import type { LinksFunction } from "@remix-run/node";
import Button from "~/components/Button";

import stylesUrl from "~/styles/index.css";
import buttonStyles from "~/styles/Button.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
  { rel: "stylesheet", href: buttonStyles },
];

export default function Route() {
  const buttonCallback = async () => {
    window.location.href = "/";
  };

  return (
    <div>
      <div className="content-main">
        <div className="search-main">
          <h3>Your session expired</h3>
          <Button text="Back Home" callback={buttonCallback} />
        </div>
      </div>
    </div>
  );
}
