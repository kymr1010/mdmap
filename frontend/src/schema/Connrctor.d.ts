import { Dimmension } from "./Point.js";
import { Card, Dir } from "./Card.js";

export interface Path {
  parent: Dimmension;
  child: Dimmension;
  c: {
    parent: Dimmension;
    child: Dimmension;
    points?: Array<{
      p: Dimmension;
      c: Dimmension;
    }>;
  };
}

export interface CardConnectorPoint {
  cardId: Card["id"];
  dir: Dir;
}

export interface CardConnector {
  parent: CardConnectorPoint;
  child: CardConnectorPoint;
  c: {
    parent: CardConnectorPoint;
    child: CardConnectorPoint;
    points?: Array<{
      p: Dimmension;
      c: Dimmension;
    }>;
  };
}
