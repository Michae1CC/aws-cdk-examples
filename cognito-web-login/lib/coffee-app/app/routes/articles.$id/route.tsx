import markdownit from "markdown-it";
import type { LinksFunction } from "@remix-run/node";

import NavigationBar from "~/components/NavigationBar";

import stylesUrl from "~/styles/index.css";
import navigationBarStylesUrl from "~/styles/NavigationBar.css";
import articlesStyles from "~/styles/articlesStyles.css";
import { useParams } from "@remix-run/react";
import { useContext, useEffect, useState } from "react";
import { DynamoDbClientContext } from "~/utils/context";
import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import type { TableItem, TableJSObject } from "~/types";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
  { rel: "stylesheet", href: navigationBarStylesUrl },
  { rel: "stylesheet", href: articlesStyles },
];

export default function Route() {
  const ddb = useContext(DynamoDbClientContext);
  const params = useParams();
  const [loading, setLoading] = useState<bool>(true);
  const [articleItem, setArticleItem] = useState<TableJSObject | undefined>(
    undefined
  );
  const [articleId, setArticleId] = useState<string | undefined>(() => {
    return params.id ?? undefined;
  });

  useEffect(() => {
    const getArticle = async () => {
      console.log(articleId);
      if (ddb === undefined || articleId === undefined) {
        return;
      }
      const response = await ddb.send(
        new GetItemCommand({
          TableName: "cognitosamltest1",
          Key: {
            email: {
              S: articleId,
            },
          },
        })
      );
      const item = response.Item as undefined | TableItem;
      if (item === undefined) {
        return;
      }
      setArticleItem({
        description: item.description.S,
      });
      setLoading(false);
    };
    getArticle();
  }, [ddb, articleId]);

  const html = markdownit().render(articleItem?.description || "");
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
