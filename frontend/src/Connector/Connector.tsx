import {
  CardConnector,
  CardConnectorPoint,
  Path,
} from "../schema/Connrctor.js";
import { Card, Dir } from "../schema/Card.js";
import { Dimmension } from "../schema/Point.js";
import { CardNode } from "../Card/CardNode.jsx";

export const calcRelaxConnectorCtrls = (
  connector: {
    pos: Dimmension;
    dir: Dir;
  },
  relax: number
) => {
  switch (connector.dir) {
    case "n":
      return {
        x: connector.pos.x,
        y: connector.pos.y - relax,
      };
    case "s":
      return {
        x: connector.pos.x,
        y: connector.pos.y + relax,
      };
    case "e":
      return {
        x: connector.pos.x + relax,
        y: connector.pos.y,
      };
    case "w":
      return {
        x: connector.pos.x - relax,
        y: connector.pos.y,
      };
  }
};

export const CardConnectorPointToDimmension = (
  cardConnectorPoint: CardConnectorPoint,
  cardNode: CardNode
): Dimmension => {
  const {
    position: { x, y },
    size: { x: w, y: h },
  } = cardNode.card();
  const abs = cardNode.position;

  switch (cardConnectorPoint.dir) {
    case "n":
      return { x: abs.x + w / 2, y: abs.y };
    case "s":
      return { x: abs.x + w / 2, y: abs.y + h };
    case "e":
      return { x: abs.x + w, y: abs.y + h / 2 };
    case "w":
      return { x: abs.x, y: abs.y + h / 2 };
  }
};

export const CardConnectorToPath = (
  connector: CardConnector,
  nodeMap: Map<number, CardNode>
): Path => {
  const fromCardNode = nodeMap.get(connector.from.cardId);
  const toCardNode = nodeMap.get(connector.to.cardId);

  if (fromCardNode === undefined || toCardNode === undefined) {
    throw new Error("Connector.tsx Card not found");
  }

  return {
    from: CardConnectorPointToDimmension(connector.from, fromCardNode),
    to: CardConnectorPointToDimmension(connector.to, toCardNode),
    c: {
      from: calcRelaxConnectorCtrls(
        {
          pos: CardConnectorPointToDimmension(
            {
              ...connector.c.from,
              cardId: connector.from.cardId,
              dir: connector.from.dir,
            },
            fromCardNode
          ),
          dir: connector.from.dir,
        },
        50
      ),
      to: calcRelaxConnectorCtrls(
        {
          pos: CardConnectorPointToDimmension(
            {
              ...connector.c.to,
              cardId: connector.to.cardId,
              dir: connector.to.dir,
            },
            toCardNode
          ),
          dir: connector.to.dir,
        },
        50
      ),
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
