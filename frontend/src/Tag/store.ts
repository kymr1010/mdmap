// src/stores/tags.ts
import { createStore } from "solid-js/store";
import type { Tag } from "../schema/Tag.js";

// our normalized tag‐map: { [tagId]: Tag }
const [tags, setTags] = createStore<Record<number, Tag>>({});

// load initial tags from API
export async function fetchTags() {
  const data = (await fetch("/api/tags").then((r) => r.json())) as Tag[];
  setTags(
    data.reduce((m, t) => {
      m[t.id] = t;
      return m;
    }, {} as Record<number, Tag>)
  );
}

// add a new tag (e.g. from the UI)
export function addTag(tag: Tag) {
  setTags(tag.id, tag);
}

// lookup helper
export const getTagById = (id: number): Tag | undefined => tags[id];

// export the store itself if you need reactive subscriptions
export { tags };
