import type { Accessor, Setter } from "solid-js";
import type { Card, Dir } from "../schema/Card.js";
import type { CardConnectorPoint } from "../schema/Connrctor.js";
import type { Dimmension } from "../schema/Point.js";

export interface CardProps {
  mousePosition: Accessor<Dimmension>;
  nodePosition: Accessor<Dimmension>;
  setNodePosition: Setter<Dimmension>;
  cardPosition: Accessor<Dimmension>;
  card: Accessor<Card>;
  setCard: (card: Card) => void;
  scaleFactor: Accessor<number>;
  canEdit: Accessor<boolean>;
  setEdittingCard: Setter<Card | null>;
  isMinimized: Accessor<boolean>;
  onToggleMinimize: (id: number) => void;
  onOpenPage: (id: number) => void;
  startConnect: (
    e: PointerEvent,
    pos: Dimmension,
    cardId: number,
    dir: Dir
  ) => void;
  onHover: (c: Card) => void;
  onLeave: () => void;
  onNearestConnector: (cardConnectorPoint: CardConnectorPoint) => void;
  onMove: (pos: Dimmension) => void;
  onUpdateCard?: (card: Card) => void;
  onDelete?: (id: number) => void;
  onDisconnectFromParent?: (id: number) => void;
  onCreateCard?: () => void;
}
