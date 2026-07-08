import { fetchAPI } from "./useAPI.js";
import type { Tag } from "../schema/Tag.js";

export const getTags = async (): Promise<Tag[]> => {
  const res = await fetchAPI("tags", { method: "GET" });
  // tags endpoint returns a bare array, not wrapped
  return res as Tag[];
};

export const createTag = async (name: string): Promise<Tag> => {
  const res = await fetchAPI("tag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: 0, name }),
  });
  return res.data as Tag;
};
