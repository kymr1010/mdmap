import {
  CardConnector,
  CardConnectorPoint,
  Path,
} from "../schema/Connrctor.js";
import { Card } from "../schema/Card.js";
import { Dimmension } from "../schema/Point.js";

export const CardConnectorPointToDimmension = (
  cardConnectorPoint: CardConnectorPoint,
  cards: Card[]
): Dimmension => {
  const {
    position: { x, y },
    size: { x: w, y: h },
  } = cards.find((card) => card.id === cardConnectorPoint.cardId) || {
    position: { x: 0, y: 0 },
    size: { x: 0, y: 0 },
  };

  switch (cardConnectorPoint.dir) {
    case "n":
      return { x: x + w / 2, y: y };
    case "s":
      return { x: x + w / 2, y: y + h };
    case "e":
      return { x: x + w, y: y + h / 2 };
    case "w":
      return { x: x, y: y + h / 2 };
  }
};
export const CardConnectorToPath = (
  connector: CardConnector,
  cards: Card[]
): Path => {
  const from = CardConnectorPointToDimmension(connector.from, cards);
  const to = CardConnectorPointToDimmension(connector.to, cards);

  return {
    from,
    to,
    c: {
      from: connector.c.from,
      to: connector.c.to,
      points: connector.c.points,
    },
  };
};

export const Connector = (props: { path: Path }) => {
  const pointsString = (props.path.c.points ?? [])
    .map(({ c, p }) => `S${p.x} ${p.y},${c.x} ${c.y}`)
    .join(",");
  const pathString = () =>
    `M${props.path.from.x} ${props.path.from.y} C${props.path.c.from.x} ${props.path.c.from.y}, ${props.path.c.to.x} ${props.path.c.to.y}, ${props.path.to.x} ${props.path.to.y}`;

  return <path d={pathString()} stroke="black" fill="none" />;
};
