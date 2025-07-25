import { styled } from "@macaron-css/solid";
import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  For,
  from,
  on,
  onMount,
  Setter,
  Show,
} from "solid-js";
import { Card, Dir } from "../schema/Card.js";
import { Dimmension } from "../schema/Point.js";
import { useDrag } from "../hooks/useDrag.js";
import { style } from "@macaron-css/core";
import { useContextMenu } from "../hooks/useContextMenu.jsx";
import { createCard, getCards } from "../hooks/useCardAPI.js";
import { useConnector } from "../hooks/useConnector.js";
import {
  calcRelaxConnectorCtrls,
  CardConnectorPointToDimmension,
  CardConnectorToPath,
  Connector,
} from "../Connector/Connector.jsx";
import {
  CardConnector,
  CardConnectorPoint,
  Path,
} from "../schema/Connrctor.js";
import { connectCards } from "../hooks/useConnectAPI.js";
import { CardRelation } from "../schema/CardRelation.js";
import { CardNode, TreeCardContainer } from "../Card/CardNode.jsx";

export interface CardContainerProps {
  position: Dimmension;
  cards: Accessor<Card[]>;
  setCards: Setter<Card[]>;
  cardRelations: Accessor<CardRelation[]>;
  setCardRelations: Setter<CardRelation[]>;
  setEdittingCard: Setter<Card | null>;
}

export const CardContainer = (props: CardContainerProps) => {
  let ref!: HTMLDivElement;
  let containerRef: HTMLDivElement | undefined;
  const tileSize = 2000;

  const [scale, setScale] = createSignal<number>(1);
  const [zoomLevel, setZoomLevel] = createSignal<number>(0);

  const ZOOM = {
    MAX: 5,
    MIN: -5,
    FACTOR: 1.25,
  };

  const [mousePosition, setMousePosition] = createSignal<Dimmension>({
    x: 0,
    y: 0,
  });
  const fixedMousePosition = () => ({
    x: Math.floor(mousePosition().x / scale()),
    y: Math.floor(mousePosition().y / scale()),
  });

  const [position, setPosition] = createSignal<Dimmension>({
    x: props.position.x,
    y: props.position.y,
  });
  const [tiles, setTiles] = createSignal<Record<string, Array<number>>>({});
  const [nowTile, setNowTile] = createSignal<string>("0,0");
  const { currentLine, startConnect } = useConnector({
    mousePosition: fixedMousePosition,
    onUpCallback: async (fromID: Card["id"]) => {
      const nearestConn = nearestConnector();
      const connectStartedConn = connectStartedConnector();
      console.log("onUpCallback", nearestConn);

      if (!nearestConn || !connectStartedConn) return;

      const card_parent_id = fromID;
      const card_child_id = nearestConn.cardId;
      const connector = {
        from: connectStartedConn,
        to: nearestConn,
        c: {
          from: connectStartedConn,
          to: nearestConn,
        },
      };
      connectCards(card_parent_id, card_child_id, connector).then((res) => {
        props.setCardRelations((prev) => [
          ...prev,
          {
            parent_id: card_parent_id,
            child_id: card_child_id,
            connector,
          },
        ]);
        const parentCard = props.cards().find((c) => c.id === card_parent_id);
        props.setCards((prev) =>
          prev.map((c) =>
            c.id === card_child_id
              ? {
                  ...c,
                  parent_id: card_parent_id,
                  position: {
                    x: c.position.x - parentCard!.position.x,
                    y: c.position.y - parentCard!.position.y,
                  },
                }
              : c
          )
        );
      });
    },
  });

  const buildTreeResult = (
    cards: Card[],
    connectors: CardRelation[]
  ): { roots: CardNode[]; nodeMap: Map<number, CardNode> } => {
    // 1) Map を作成
    const nodeMap = new Map<number, CardNode>();
    cards.forEach((card) => {
      const connector = connectors.find(
        (c) => c.child_id === card.id
      )?.connector;
      nodeMap.set(card.id, {
        card: () => card,
        setCard: (updated) => {
          props.setCards((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
          );
        },
        connector: connector ? () => connector : undefined,
        setConnector: connector
          ? (newConn) =>
              props.setCardRelations((prev) =>
                prev.map((c) =>
                  c.child_id === card.id ? { ...c, connector: newConn } : c
                )
              )
          : undefined,
        children: [],
        position: { x: 0, y: 0 },
      });
    });

    // 2) 親子リンクを張って roots を集める
    const roots: CardNode[] = [];
    nodeMap.forEach((node) => {
      const c = node.card();
      if (c.parent_id == null) {
        roots.push(node);
      } else {
        const parent = nodeMap.get(c.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
    });

    // 3) 親子ツリーを再帰して absPosition を計算
    const annotate = (node: CardNode, parentAbs: Dimmension) => {
      const rel = node.card().position;
      const abs = { x: parentAbs.x + rel.x, y: parentAbs.y + rel.y };
      node.position = abs;
      node.children.forEach((child) => annotate(child, abs));
    };
    roots.forEach((root) => annotate(root, { x: 0, y: 0 }));

    return { roots, nodeMap };
  };

  const treeData = createMemo(() =>
    buildTreeResult(props.cards(), props.cardRelations())
  );
  const nodes = () => treeData().roots;
  const nodeMap = () => treeData().nodeMap;

  const { onContextMenu, ContextMenu } = useContextMenu([
    { label: "作成", action: () => addCard() },
    { label: "作成", action: () => console.log("作成しました") },
  ]);

  const [hoveredCard, setHoveredCard] = createSignal<Card | null>(null);
  const [connectStartedConnector, setConnectStartedConnector] =
    createSignal<CardConnectorPoint | null>(null);
  const [nearestConnector, setNearestConnector] =
    createSignal<CardConnectorPoint | null>(null);

  const currentTile = () => ({
    x: Math.floor((-position().x + window.innerWidth / 2) / scale() / tileSize),
    y: Math.floor(
      (-position().y + window.innerHeight / 2) / scale() / tileSize
    ),
  });

  // position が変わったら currentTile を更新
  createEffect(
    on(position, () => {
      const { x: cx, y: cy } = currentTile();
      setNowTile(`${cx},${cy}`);
    })
  );

  // nowTile が変わったら周囲 3×3 をフェッチ＆古いものをクリア
  createEffect(
    on(nowTile, () => {
      const [cx, cy] = nowTile().split(",").map(Number);
      const needed = new Set<string>();
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          needed.add(`${cx + dx},${cy + dy}`);
        }
      }

      // 足りないタイルだけフェッチ
      needed.forEach((key) => {
        if (!(key in tiles())) {
          const [tx, ty] = key.split(",").map(Number);
          const minX = tx * tileSize;
          const minY = ty * tileSize;
          const maxX = minX + tileSize;
          const maxY = minY + tileSize;

          fetch(
            `http://localhost:8082/cards/in_range?min_x=${minX}&min_y=${minY}&max_x=${maxX}&max_y=${maxY}`
          )
            .then((r) => r.json() as Promise<Card[]>)
            .then((res) => {
              const cards: number[] = [];
              res.data.forEach((card) => {
                if (props.cards().some((c) => c.id === card.id)) return;
                cards.push(card.id);
                props.setCards((prev) => [...prev, card]);
              });
              console.log(res);
              setTiles((prev) => ({ ...prev, [key]: cards }));
            })
            .catch(console.error);
        }
      });
    })
  );

  createEffect(
    on(
      zoomLevel,
      (current, prev = 0) => {
        setScale(Math.pow(ZOOM.FACTOR, zoomLevel()));
        const factor = Math.pow(ZOOM.FACTOR, current - prev);
        console.log(factor);
        const positionFix = {
          x: mousePosition().x * (1 - factor), // 拡縮に伴うマウスの移動ベクトル（移動前-移動後）
          y: mousePosition().y * (1 - factor),
        };
        setPosition((prev) => {
          return {
            x: Math.floor(prev.x + positionFix.x), // 移動ベクトルを加算することでマウス座標を中心に拡縮
            y: Math.floor(prev.y + positionFix.y),
          };
        });
        setMousePosition((prev) => {
          return {
            x: Math.floor(prev.x * factor), // 移動後ベクトル
            y: Math.floor(prev.y * factor),
          };
        });
      },
      { defer: true }
    )
  );

  onMount(() => {
    useDrag({
      ref,
      getPos: position,
      setPos: setPosition,
      mousePosition: mousePosition,
      scaleFactor: () => 1,
    }); // Container のスクロールは zoomLevel の範疇外なので factor は 1
  });

  const addCard = () => {
    const newCard = {
      id: 0,
      position: {
        x: fixedMousePosition().x,
        y: fixedMousePosition().y,
      },
      size: {
        x: 100,
        y: 100,
      },
      title: "",
      contents: "",
      tag_ids: [],
      card_ids: [],
    };
    console.log(newCard);
    createCard(newCard).then((res) => {
      console.log(res);
      props.setCards((prev) => [...prev, res.data]);
    });
  };

  const handleScroll = (event: WheelEvent) => {
    event.preventDefault();

    const delta = event.deltaY > 0 ? 1 : -1;
    if (zoomLevel() + delta > ZOOM.MAX || zoomLevel() + delta < ZOOM.MIN)
      return;

    setZoomLevel((prev) =>
      Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, prev + delta))
    );
  };

  const addCardRelation = (
    from: Card["id"],
    to: Card["id"],
    connector: CardConnector
  ) => {
    props.setCardRelations((prev) => [
      ...prev,
      {
        parent_id: from,
        child_id: to,
        connector,
      },
    ]);
  };

  const visibleCards = () => {
    const { x: cx, y: cy } = currentTile();
    const neededKeys: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        neededKeys.push(`${cx + dx},${cy + dy}`);
      }
    }
    // tiles()[key] があれば展開、なければ空配列
    return neededKeys.flatMap((key) => tiles()[key] ?? []);
  };

  const visibleCardData = createMemo(() =>
    visibleCards() // number[]
      .map((id) => props.cards().find((c) => c.id === id))
      .filter((c): c is Card => !!c)
  );

  const nowCardConnectPath = (): Path => {
    const conn = connectStartedConnector();
    const near = nearestConnector();

    if (!conn) {
      console.error("connectStartedConnector is null");
      return;
    }

    const fromCardNode = nodeMap().get(conn.cardId);
    const toCardNode = nodeMap().get(near?.cardId ?? 0);

    if (!fromCardNode) {
      console.error("Card not found");
      return;
    }

    return {
      from: CardConnectorPointToDimmension(conn, fromCard),
      to:
        near && toCard
          ? CardConnectorPointToDimmension(near, toCard)
          : currentLine()!.to,
      c: {
        from: calcRelaxConnectorCtrls(
          {
            pos: CardConnectorPointToDimmension(conn, fromCard),
            dir: conn.dir,
          },
          50
        ),
        to:
          near && toCard
            ? calcRelaxConnectorCtrls(
                {
                  pos: CardConnectorPointToDimmension(near, toCard),
                  dir: near.dir,
                },
                50
              )
            : currentLine()!.to,
      },
    };
  };

  return (
    <>
      <StyledCardContainer
        ref={ref}
        on:wheel={handleScroll}
        on:mousemove={(e) => {
          setMousePosition({
            x: e.clientX - position().x,
            y: e.clientY - position().y,
          });
        }}
        style={{
          position: "absolute",
          "background-size": `${20 * scale()}px ${20 * scale()}px`,
          "background-position": `${position().x}px ${position().y}px`,
        }}
        oncontextmenu={onContextMenu}
        data-card-container
      >
        <div
          ref={(el) => (containerRef = el!)}
          style={{
            position: "absolute",
            transform: `translate3d(${position().x}px, ${
              position().y
            }px, 0) scale(${scale()})`,
          }}
        >
          <For each={nodes()}>
            {(root) => (
              <TreeCardContainer
                node={() => ({
                  position: root.position,
                  card: root.card,
                  setCard: root.setCard,
                  children: root.children,
                  connector: root.connector,
                  setConnector: root.setConnector,
                })}
                scaleFactor={scale}
                cardContainerUtilProps={{
                  mousePosition,
                  fixedMousePosition,
                  scale,
                  setCards: props.setCards,
                  startConnect,
                  setConnectStartedConnector,
                  nearestConnector,
                  setNearestConnector,
                  setEdittingCard: props.setEdittingCard,
                  setHoveredCard,
                }}
              />
            )}
          </For>
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
            <For each={props.cardRelations()}>
              {(item) => (
                <Connector
                  path={CardConnectorToPath(item.connector, nodeMap())}
                />
              )}
            </For>
            <Show when={currentLine() !== null}>
              <Connector path={nowCardConnectPath()} />
            </Show>
          </svg>
        </div>
      </StyledCardContainer>
      <div
        class={style({
          position: "absolute",
          left: 0,
          top: 0,
          // pointerEvents: "none",
        })}
      >
        <p>{nowTile()}</p>
        <p>
          {position().x},{position().y}
        </p>
        <p>
          {mousePosition().x},{mousePosition().y}
        </p>
        <input type="range" min={ZOOM.MIN} max={ZOOM.MAX} value={zoomLevel()} />
        <label>
          ZOOM: {zoomLevel()} SCALE: {scale()}
        </label>
        <p>
          {connectStartedConnector()?.cardId},{connectStartedConnector()?.dir},
          {nearestConnector()?.dir},{nearestConnector()?.cardId}
        </p>
        <p>{JSON.stringify(nowCardConnectPath())}</p>
        <p>{currentLine()?.from.x}</p>
        <button onClick={() => console.log(nodes())}>nodes</button>
        <button onClick={() => console.log(props.cards())}>cards</button>
        <button onClick={() => console.log(props.cardRelations())}>conn</button>
      </div>
      <ContextMenu />
    </>
  );
};

const StyledCardContainer = styled("div", {
  base: {
    position: "relative",
    display: "block",
    width: "3840px",
    height: "2160px",
    backgroundColor: "var(--color-bg, #fff)",
    backgroundImage:
      `linear-gradient(to right, var(--color-bg-border, #eee) 1px, transparent 1px),` +
      `linear-gradient(to bottom, var(--color-bg-border, #eee) 1px, transparent 1px)`,
  },
});
