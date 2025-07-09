import { Card } from "../schema/Card.js";
import { Path } from "../schema/Path.js";
import { fetchAPI } from "./useAPI.js";

export const getCards = async () => {
  await fetchAPI("cards_connect", {
    method: "GET",
  });
};
export const connectCards = async (
  parentId: Card["id"],
  childId: Card["id"],
  parh: Path
) => {
  console.log(parentId, childId, JSON.stringify(parh));
  await fetchAPI("cards_connect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      card_parent_id: parentId,
      card_child_id: childId,
      path: JSON.stringify(parh),
    }),
  });
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
    }),
  });
};
