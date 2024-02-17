import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { useContext, useEffect, useState } from "react";
import { DynamoDbClientContext } from "~/utils/context";
import type { TableItem } from "~/types";

export default function FeaturedList() {
  const ddb = useContext(DynamoDbClientContext);
  const [items, setItems] = useState<Array<{ description: string }>>([]);

  useEffect(() => {
    const getData = async () => {
      if (ddb === undefined) {
        return;
      }
      const response = await ddb.send(
        new ScanCommand({
          TableName: "cognitosamltest1",
          Limit: 10,
        })
      );

      const rawItems = response.Items;
      if (rawItems !== undefined)
        setItems(
          rawItems.map((item) => {
            return {
              description: (item as TableItem).description.S,
            };
          })
        );
    };
    getData();
  }, [ddb]);

  return (
    <div className="featured-list">
      <h3>Featured</h3>
      <hr />
      {items.map((item, index) => {
        return (
          <div className="featured-list-item" key={`featured-list-${index}`}>
            <a href="/">
              <h4>Filler title</h4>
              <div>{item.description}</div>
            </a>
          </div>
        );
      })}
    </div>
  );
}
