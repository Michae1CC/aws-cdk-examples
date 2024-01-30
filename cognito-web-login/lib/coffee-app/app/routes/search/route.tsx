
import type { LinksFunction } from "@remix-run/node";

import NavigationBar from "~/components/NavigationBar";

import stylesUrl from "~/styles/index.css";
import navigationBarStylesUrl from "~/styles/NavigationBar.css";
import searchStyles from "~/styles/search.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
  { rel: "stylesheet", href: navigationBarStylesUrl },
  { rel: "stylesheet", href: searchStyles },
];

export default function Route() {
  return (
    <div>
      <NavigationBar />
      <div className="content-main">
        <div className="search-main">
          <h3>Search By Title</h3>
          <input type="text"></input>
          <hr />
        </div>
      </div>
    </div>
  );
}