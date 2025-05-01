import { Dimmension } from "../schema/Point.js";

export interface Card {
  position: Dimmension;
  size: Dimmension;
  title: string;
  contents: string;
}
