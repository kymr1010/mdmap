import { Card } from "./Card.js";
import { CardConnector, Path } from "./Connrctor.js";

export interface CardRelation {
  parent_id: Card["id"];
  child_id: Card["id"];
  // null for "containment" relations (frame parent/child) which draw no line.
  connector: CardConnector | null;
}
