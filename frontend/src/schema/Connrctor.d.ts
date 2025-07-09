import { Dimmension } from "./Point.js";
import { Card, Dir } from "./Card.js";

export interface Path {
  from: Dimmension;
  to: Dimmension;
  c: {
    from: Dimmension;
    to: Dimmension;
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
  from: CardConnectorPoint;
  to: CardConnectorPoint;
  c: {
    from: CardConnectorPoint;
    to: CardConnectorPoint;
    points?: Array<{
      p: Dimmension;
      c: Dimmension;
    }>;
  };
}
