import { PathElm } from "../Connector/Connector.jsx";
import { Card } from "../schema/Card.js";
import { CardRelation } from "../schema/CardRelation.js";
import { CardConnector, Path } from "../schema/Connrctor.js";
import { fetchAPI } from "./useAPI.js";

export const getCardRelations: () => Promise<CardRelation[]> = async () => {
  const res = await fetchAPI("cards_connect", {
    method: "GET",
  });
  const data = res.data;
  console.log(data);
  return data.map(
    (item: any): CardRelation => ({
      parent_id: item.card_parent_id,
      child_id: item.card_child_id,
      connector: JSON.parse(item.connector),
    })
  );
};

export const connectCards = async (
  parentId: Card["id"],
  childId: Card["id"],
  connector: CardConnector
) => {
  console.log(
    JSON.stringify({
      card_parent_id: parentId,
      card_child_id: childId,
      connector: connector,
    })
  );
  const res = await fetchAPI("cards_connect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      card_parent_id: parentId,
      card_child_id: childId,
      connector: JSON.stringify(connector),
    }),
  });
  console.log(res.body);
};

export const disconnectCards = async (
  parentId: Card["id"],
  childId: Card["id"]
) => {
  await fetchAPI("cards_connect", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      card_parent_id: parentId,
      card_child_id: childId,
      // Backend requires this field in payload schema even on DELETE
      connector: "{}",
    }),
  });
};
