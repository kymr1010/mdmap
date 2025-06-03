import { Dimmension } from "./Point.js";

export interface Card {
  id: number;
  position: Dimmension;
  size: Dimmension;
  title: string;
  contents: string;
  tag_ids: number[];
  card_ids: number[];
}
