import {
  Accessor,
  Component,
  createSignal,
  createMemo,
  onMount,
  For,
  Setter,
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

export type CardNode = {
  card: Accessor<Card>;
  setCard: (card: Card) => void;
  connector?: Accessor<CardConnector>;
  setConnector?: (path: CardConnector) => void;
  children: CardNode[];
};

interface TreeCardProps {
  node: Accessor<CardNode>;
  parentAbs: Accessor<Dimmension>;
  setAllNodes: Setter<CardNode[]>;
  scaleFactor: Accessor<number>;
  mousePosition: Accessor<Dimmension>;
}

export const TreeCardContainer: Component<
  TreeCardProps & {
    cardContainerUtilProps: {
      mousePosition: Accessor<Dimmension>;
      fixedMousePosition: Accessor<Dimmension>;
      scale: Accessor<number>;
      setCards: Setter<Card[]>;
      startConnect: (e: PointerEvent, pos: Dimmension, cardId: number) => void;
      setConnectStartedConnector: Setter<CardConnectorPoint | null>;
      nearestConnector: Accessor<CardConnectorPoint | null>;
      setNearestConnector: Setter<CardConnectorPoint | null>;
      setEdittingCard: Setter<Card | null>;
      setHoveredCard: Setter<Card | null>;
    };
  }
> = (props) => {
  // 自身の相対座標
  const [position, setPosition] = createSignal<Dimmension>({
    x: props.node().card().position.x,
    y: props.node().card().position.y,
  });

  // 親の絶対座標（初回は 0,0）
  const parentAbs = props.parentAbs;

  // 自身の絶対座標を計算
  const absPos = createMemo<Dimmension>(() => ({
    x: parentAbs().x + position().x,
    y: parentAbs().y + position().y,
  }));

  onMount(() => {
    console.log("TreeCardContainer onMount");
  });

  return (
    <div
      style={{
        position: "absolute",
        left: `${position().x}px`,
        top: `${position().y}px`,
      }}
    >
      {/* 実際のカード表示 */}
      <CardElm
        card={props.node().card}
        position={[position, setPosition]}
        mousePosition={props.cardContainerUtilProps.mousePosition}
        setCard={props.node().setCard}
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
          console.log(diff);
        }}
      />

      {/* 子ノードを再帰レンダリング */}
      <For each={props.node().children}>
        {(child) => (
          <TreeCardContainer
            node={() => child}
            parentAbs={absPos}
            setAllNodes={props.setAllNodes}
            scaleFactor={props.scaleFactor}
            mousePosition={props.cardContainerUtilProps.mousePosition}
            cardContainerUtilProps={props.cardContainerUtilProps}
          />
        )}
      </For>
    </div>
  );
};
