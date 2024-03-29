import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { useContext, useEffect, useState } from "react";
import { DynamoDbClientContext, EnvContext } from "~/utils/context";
import type { TableItem } from "~/types";

export default function FeaturedList() {
  const ddb = useContext(DynamoDbClientContext);
  const env = useContext(EnvContext);
  const [items, setItems] = useState<Array<TableItem>>([]);

  useEffect(() => {
    const getData = async () => {
      if (ddb === undefined) {
        return;
      }
      const response = await ddb.send(
        new ScanCommand({
          TableName: env.TABLE_NAME,
          Limit: 10,
        })
      );

      const rawItems = response.Items;
      if (rawItems !== undefined) setItems(rawItems as Array<TableItem>);
    };
    getData();
  }, [ddb, env]);

  return (
    <div className="featured-list">
      <h3>Featured</h3>
      <hr />
      {items.map((item, index) => {
        return (
          <div className="featured-list-item" key={`featured-list-${index}`}>
            <a href={`/articles/${item.id.S}`}>
              <h4>{item.title.S}</h4>
              <div>{item.body.S}</div>
            </a>
          </div>
        );
      })}
    </div>
  );
}
