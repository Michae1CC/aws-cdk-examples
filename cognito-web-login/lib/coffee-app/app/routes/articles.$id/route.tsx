import markdownit from "markdown-it";
import type { LinksFunction } from "@remix-run/node";

import NavigationBar from "~/components/NavigationBar";

import stylesUrl from "~/styles/index.css";
import navigationBarStylesUrl from "~/styles/NavigationBar.css";
import articlesStyles from "~/styles/articlesStyles.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
  { rel: "stylesheet", href: navigationBarStylesUrl },
  { rel: "stylesheet", href: articlesStyles },
];

export default function Route() {
  const articleText =
    "### Intro\n\n" +
    "---\n" +
    "Some text\n" +
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam et" +
    "venenatis risus. Integer at ipsum vehicula, laoreet enim a, varius" +
    "purus. Cras at aliquam est, quis ultricies risus.\n" +
    "* First Item in list\n" +
    "* Second Item in list\n" +
    "* Third Item in list\n";

  const html = markdownit().render(articleText);
  return (
    <div>
      <NavigationBar />
      <div className="content-main">
        <div className="article-main">
          <h2>Title</h2>
          <hr />
          <div
            className="article-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
