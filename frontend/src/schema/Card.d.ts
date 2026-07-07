import { Dimmension } from "./Point.js";

export type CardVisibility = "public" | "private";

// Card rendering type. Extend this union as new types are added.
export type CardType = "normal" | "frame";

export interface Card {
  id: number;
  position: Dimmension;
  size: Dimmension;
  title: string;
  contents: string;
  parent_id?: Card["id"];
  tag_ids: number[];
  /** publication scope: "public" (everyone) or "private" (admin only) */
  visibility?: CardVisibility;
  /** rendering type; "frame" shows a large region and auto-parents cards created inside it */
  card_type?: CardType;
  created_at: string;
  updated_at: string;
}

export type Dir = "n" | "s" | "e" | "w";
export type Dir8 = dir | "ne" | "nw" | "se" | "sw";
