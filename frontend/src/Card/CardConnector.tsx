import { Accessor, createMemo, from } from "solid-js";
import { CardConnector } from "../schema/Connrctor.js";
import { Card } from "../schema/Card.js";
import { CardConnectorToPath, PathElm } from "../Connector/Connector.jsx";
import { Node } from "../schema/CardNode.js";

export const CardConnectorElm = (props: {
  childCardNode: Node;
  parentCardNode: Node;
}) => {
  return props.childCardNode.connector ? (
    <PathElm
      path={CardConnectorToPath(
        props.childCardNode.connector(),
        props.parentCardNode,
        props.childCardNode
      )}
    />
  ) : null;
};
