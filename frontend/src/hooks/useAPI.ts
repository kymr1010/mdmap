import { Card } from "../schema/Card.js";

export const fetchAPI = async (url: string, options: RequestInit) => {
  const res = await fetch(`http://localhost:8082/${url}`, options);
  console.log(res);
  return res.json();
};

export const getCards = async () => {
  const cards = await fetchAPI("cards", {
    method: "GET",
  });
  return cards;
};

export const createCard = async (card: Card) => {
  await fetchAPI("card", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(card),
  });
};

export const updateCard = async (card: Card) => {
  await fetchAPI("card", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(card),
  });
};
