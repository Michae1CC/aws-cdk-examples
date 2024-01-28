import type { LinksFunction } from "@remix-run/node";

import NavigationBar from "~/components/NavigationBar";

import stylesUrl from "~/styles/index.css";
import navigationBarStylesUrl from "~/styles/NavigationBar.css";
import createStyles from "~/styles/create.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
  { rel: "stylesheet", href: navigationBarStylesUrl },
  { rel: "stylesheet", href: createStyles },
];

export default function Route() {
  return (
    <div>
      <NavigationBar />
      <div className="content-main">
        <div className="create-main">
            Create
        </div>
      </div>
    </div>
  );
}