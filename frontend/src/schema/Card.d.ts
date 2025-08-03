import { Dimmension } from "./Point.js";

export interface Card {
  id: number;
  position: Dimmension;
  size: Dimmension;
  title: string;
  contents: string;
  parent_id?: Card["id"];
  tag_ids: number[];
  created_at: string;
  updated_at: string;
}

export type Dir = "n" | "s" | "e" | "w";
export type Dir8 = dir | "ne" | "nw" | "se" | "sw";
