import { styled } from "@macaron-css/solid";
import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onMount,
  Setter,
  Show,
} from "solid-js";
import { Card } from "../Card/Card.jsx";
import { Card as CardProps } from "../schema/Card.js";
import { Dimmension } from "../schema/Point.js";
import { useDrag } from "../hooks/useDrag.js";
import { style } from "@macaron-css/core";
import { useContextMenu } from "../hooks/useContextMenu.jsx";
import { createCard, getCards } from "../hooks/useCardAPI.js";
import { useConnector } from "../hooks/useConnector.js";
import { Connector } from "../Connector/Connector.jsx";
import { Path } from "../schema/Path.js";

export const CardContainer = (props: {
  position: Dimmension;
  cards: Accessor<CardProps[]>;
  setCards: Setter<CardProps[]>;
  cardRelations: Accessor<number[]>;
  setCardRelations: Setter<number[]>;
  setEdittingCard: Setter<CardProps | undefined>;
}) => {
  let ref!: HTMLDivElement;
  let containerRef: HTMLDivElement | undefined;
  const tileSize = 2000;

  const [scale, setScale] = createSignal<number>(1);
  const [zoomLevel, setZoomLevel] = createSignal<number>(0);
  let beforeDelta = 0;
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
    onUpCallback: () => {},
  });

  const { onContextMenu, ContextMenu } = useContextMenu([
    { label: "作成", action: () => addCard() },
    { label: "作成", action: () => console.log("作成しました") },
  ]);

  const [hoveredCard, setHoveredCard] = createSignal<CardProps | null>(null);
  const [connectStartedConnector, setConnectStartedConnector] = createSignal<{
    pos: Dimmension;
    dir: string;
  } | null>(null);
  const [nearestConnector, setNearestConnector] = createSignal<{
    pos: Dimmension;
    dir: string;
  } | null>(null);

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
            `http://localhost:8082/cards?min_x=${minX}&min_y=${minY}&max_x=${maxX}&max_y=${maxY}`
          )
            .then((r) => r.json() as Promise<CardProps[]>)
            .then((data) => {
              // console.log(data);
              const cards: number[] = [];
              data.forEach((card) => {
                if (props.cards().some((c) => c.id === card.id)) return;
                cards.push(card.id);
                props.setCards((prev) => [...prev, card]);
              });

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
    createCard(newCard);
    props.setCards((prev) => [...prev, newCard]);
  };

  const handleScroll = (event: WheelEvent) => {
    event.preventDefault();

    const delta = event.deltaY > 0 ? 1 : -1;
    beforeDelta = delta > 0 ? 1 : -1;
    if (zoomLevel() + delta > ZOOM.MAX || zoomLevel() + delta < ZOOM.MIN)
      return;

    setZoomLevel((prev) =>
      Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, prev + delta))
    );
  };

  const addCardRelation = (
    from: CardProps["id"],
    to: CardProps["id"],
    parh: Path
  ) => {
    props.setCardRelations((prev) => [...prev, [from, to, parh]]);
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
      .filter((c): c is CardProps => !!c)
  );

  const calcRelaxConnectorCtrls = (
    connector: {
      pos: Dimmension;
      dir: string;
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
          <For each={visibleCardData()}>
            {(card) => (
              <Card
                card={card}
                setCard={(updated: CardProps) =>
                  props.setCards((prev) =>
                    prev.map((c) => (c.id === updated.id ? updated : c))
                  )
                }
                startConnect={(e, pos, cardId) => {
                  startConnect(e, pos, cardId);
                  setConnectStartedConnector(nearestConnector());
                }}
                setEdittingCard={props.setEdittingCard}
                scaleFactor={scale}
                onHover={(c) => setHoveredCard(c)}
                onLeave={() => {
                  setHoveredCard(null);
                  setNearestConnector(null);
                }}
                onNearestConnector={(pos, dir) =>
                  setNearestConnector({ pos, dir })
                }
              />
            )}
          </For>
          <Show when={currentLine() !== null}>
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
              <Connector
                from={connectStartedConnector()?.pos}
                to={nearestConnector()?.pos || currentLine()!.to}
                c={{
                  from: calcRelaxConnectorCtrls(connectStartedConnector(), 50),
                  to: nearestConnector()?.pos
                    ? calcRelaxConnectorCtrls(nearestConnector()!, 50)
                    : currentLine()!.to,
                }}
              />
            </svg>
          </Show>
        </div>
      </StyledCardContainer>
      <div
        class={style({
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
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
          {nearestConnector()?.pos.x},{nearestConnector()?.pos.y},
          {nearestConnector()?.dir}
        </p>
        <p>{currentLine()?.from.x}</p>
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
