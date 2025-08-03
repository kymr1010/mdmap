import {
  CardConnector,
  CardConnectorPoint,
  Path,
} from "../schema/Connrctor.js";
import { Card, Dir } from "../schema/Card.js";
import { Dimmension } from "../schema/Point.js";
import { Node } from "../schema/CardNode.js";

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
  cardNode: Node
): Dimmension => {
  const {
    size: { x: w, y: h },
  } = cardNode.card();
  const pos = cardNode.realtimePosition[0]();

  switch (cardConnectorPoint.dir) {
    case "n":
      return { x: pos.x + w / 2, y: pos.y };
    case "s":
      return { x: pos.x + w / 2, y: pos.y + h };
    case "e":
      return { x: pos.x + w, y: pos.y + h / 2 };
    case "w":
      return { x: pos.x, y: pos.y + h / 2 };
  }
};

export const CardConnectorToPath = (
  connector: CardConnector,
  parentCardNode: Node,
  childCardNode: Node
): Path => {
  if (parentCardNode === undefined || childCardNode === undefined) {
    throw new Error("Connector:: Card not found");
  }

  return {
    parent: CardConnectorPointToDimmension(connector.parent, parentCardNode),
    child: CardConnectorPointToDimmension(connector.child, childCardNode),
    c: {
      parent: calcRelaxConnectorCtrls(
        {
          pos: CardConnectorPointToDimmension(
            {
              ...connector.c.parent,
              cardId: connector.parent.cardId,
              dir: connector.parent.dir,
            },
            parentCardNode
          ),
          dir: connector.parent.dir,
        },
        50
      ),
      child: calcRelaxConnectorCtrls(
        {
          pos: CardConnectorPointToDimmension(
            {
              ...connector.c.child,
              cardId: connector.child.cardId,
              dir: connector.child.dir,
            },
            childCardNode
          ),
          dir: connector.child.dir,
        },
        50
      ),
      points: connector.c.points,
    },
  };
};

export const PathElm = (props: { path: Path }) => {
  const pointsString = (props.path.c.points ?? [])
    .map(({ c, p }) => `S${p.x} ${p.y},${c.x} ${c.y}`)
    .join(",");
  const pathString = () =>
    `M${props.path.parent.x} ${props.path.parent.y} C${props.path.c.parent.x} ${props.path.c.parent.y}, ${props.path.c.child.x} ${props.path.c.child.y}, ${props.path.child.x} ${props.path.child.y}`;

  return <path d={pathString()} stroke="black" fill="none" />;
};
