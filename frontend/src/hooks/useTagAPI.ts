import { fetchAPI } from "./useAPI.js";
import type { Tag } from "../schema/Tag.js";

export const getTags = async (): Promise<Tag[]> => {
  const res = await fetchAPI("tags", { method: "GET" });
  // tags endpoint returns a bare array, not wrapped
  return res as Tag[];
};

// Note: backend create_tag does not return the created row/id currently
export const createTag = async (name: string): Promise<void> => {
  await fetchAPI("tag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: 0, name }),
  });
};
