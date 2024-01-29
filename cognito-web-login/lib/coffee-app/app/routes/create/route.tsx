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
          <h2>New Article</h2>
          <hr />
          <div className="property-edit">
            <h4>Title</h4>
            <input type="text"></input>
          </div>
          <div className="property-edit">
            <h4>Content</h4>
            <textarea/>
          </div>
        </div>
      </div>
    </div>
  );
}