import { Card } from "../schema/Card.js";
import { fetchAPI } from "./useAPI.js";

export const getCards = async () => {
  const res = await fetchAPI("cards", {
    method: "GET",
  });
  console.log(res);
  return res.data;
};

export const createCard = async (card: Card) => {
  console.log("Creating card: %o", JSON.stringify(card));
  await fetchAPI("card", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(card),
  });
};

export const updateCard = async (card: Card) => {
  console.log("Updating card: %o", JSON.stringify(card));
  await fetchAPI("card", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(card),
  });
};
