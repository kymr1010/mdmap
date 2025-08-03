import {
  Accessor,
  Component,
  createSignal,
  createMemo,
  onMount,
  For,
  Setter,
  createEffect,
  on,
} from "solid-js";
import { CardElm, CardProps } from "./Card.jsx";
import { useDrag } from "../hooks/useDrag.js";
import type { Dimmension } from "../schema/Point.js";
import type { Card } from "../schema/Card.js";
import {
  CardConnector,
  CardConnectorPoint,
  Path,
} from "../schema/Connrctor.js";
import { CardContainerProps } from "../CardContainer/CardContainer.jsx";
import { Node } from "../schema/CardNode.js";
import { CardConnectorElm } from "./CardConnector.jsx";
import { style } from "@macaron-css/core";
import { Portal } from "solid-js/web";

interface CardNodeElmProps {
  node: Node;
  scaleFactor: Accessor<number>;
}

export const CardNodeElm: Component<
  CardNodeElmProps & {
    cardContainerUtilProps: {
      nodeMap: Accessor<Map<Card["id"], Node>>;
      mousePosition: Accessor<Dimmension>;
      fixedMousePosition: Accessor<Dimmension>;
      scale: Accessor<number>;
      startConnect: (e: PointerEvent, pos: Dimmension, cardId: number) => void;
      setConnectStartedConnector: Setter<CardConnectorPoint | null>;
      nearestConnector: Accessor<CardConnectorPoint | null>;
      setNearestConnector: Setter<CardConnectorPoint | null>;
      setEdittingCard: Setter<Card | null>;
      setHoveredCard: Setter<Card | null>;
    };
  }
> = (props) => {
  const [position, setPosition] = createSignal<Dimmension>(
    props.node.position()
  );

  const cardPosition = createMemo(() => {
    const abs = props.cardContainerUtilProps
      .nodeMap()
      .get(props.node.parentId());
    return {
      x: position().x - (abs ? abs.position().x : 0),
      y: position().y - (abs ? abs.position().y : 0),
    };
  });

  createEffect(
    on(position, (position: Dimmension) => {
      props.node.realtimePosition[1](position);
    })
  );

  createEffect(
    on(props.node.realtimePosition[0], (position: Dimmension) => {
      props.node.children.forEach((child: Node) => {
        child.realtimePosition[1]({
          x: position.x + child.card().position.x,
          y: position.y + child.card().position.y,
        });
      });
    })
  );

  return (
    <div
      style={{
        position: "absolute",
        left: `${cardPosition().x}px`,
        top: `${cardPosition().y}px`,
      }}
    >
      <CardElm
        card={props.node.card()}
        mousePosition={props.cardContainerUtilProps.mousePosition}
        setNodePosition={setPosition}
        nodePosition={position}
        cardPosition={cardPosition}
        setCard={props.node.setCard}
        startConnect={(e, pos, cardId) => {
          props.cardContainerUtilProps.startConnect(e, pos, cardId);
          props.cardContainerUtilProps.setConnectStartedConnector(
            props.cardContainerUtilProps.nearestConnector()
          );
        }}
        setEdittingCard={props.cardContainerUtilProps.setEdittingCard}
        scaleFactor={props.cardContainerUtilProps.scale}
        onHover={(card) => props.cardContainerUtilProps.setHoveredCard(card)}
        onLeave={() => {
          props.cardContainerUtilProps.setHoveredCard(null);
          props.cardContainerUtilProps.setNearestConnector(null);
        }}
        onNearestConnector={(cardConnectorPoint: CardConnectorPoint) =>
          props.cardContainerUtilProps.setNearestConnector(cardConnectorPoint)
        }
        onMove={(diff) => {
          // setPosition(diff);
        }}
      />
      <For each={props.node.children}>
        {(child) => (
          <CardNodeElm
            node={child}
            scaleFactor={props.scaleFactor}
            cardContainerUtilProps={props.cardContainerUtilProps}
          />
        )}
      </For>
      {/* <Portal mount={document.querySelector("#card-container-inner")}>
        <svg
          class={style({
            position: "absolute",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            pointerEvents: "none",
            overflow: "visible",
          })}
          xmlns="http://www.w3.org/2000/svg"
        >
          <For each={props.node.children}>
            {(childNode) =>
              childNode.connector ? (
                <CardConnectorElm
                  childCardNode={childNode}
                  parentCardNode={props.node}
                />
              ) : null
            }
          </For>
        </svg>
      </Portal> */}
    </div>
  );
};
