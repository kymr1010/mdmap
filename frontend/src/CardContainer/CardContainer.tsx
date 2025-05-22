import { styled } from "@macaron-css/solid";
import { createEffect, createSignal, For, on, onMount } from "solid-js";
import { Card } from "../Card/Card.jsx";
import { Card as CardProps } from "../schema/Card.js";
import { Dimmension } from "../schema/Point.js";
import { useDrag } from "../hooks/useDrag.js";
import { style } from "@macaron-css/core";
import { useContextMenu } from "../hooks/useContextMenu.jsx";
import { createCard, getCards } from "../hooks/useAPI.js";

export const CardContainer = (props: { position: Dimmension }) => {
  let ref!: HTMLDivElement;
  const tileSize = 5000;

  const [mousePosition, setMousePosition] = createSignal<Dimmension>({
    x: 0,
    y: 0,
  });
  const [position, setPosition] = createSignal<Dimmension>({
    x: props.position.x,
    y: props.position.y,
  });
  const [tiles, setTiles] = createSignal<Record<string, CardProps[]>>({});
  const [nowTile, setNowTile] = createSignal<string>("0,0");

  const { onContextMenu, ContextMenu } = useContextMenu([
    { label: "作成", action: () => addCard() },
    { label: "作成", action: () => console.log("作成しました") },
  ]);

  const [scale, setScale] = createSignal<number>(1);
  const [zoomLevel, setZoomLevel] = createSignal<number>(0);
  let beforeDelta = 0;
  const ZOOM = {
    MAX: 5,
    MIN: -5,
    FACTOR: 1.25,
  };

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
              setTiles((prev) => ({ ...prev, [key]: data }));
            });
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
    useDrag(ref, position, setPosition, () => 1); // Container のスクロールは zoomLevel の範疇外なので factor は 1
  });

  const addCard = () => {
    createCard({
      id: 0,
      position: {
        x: mousePosition().x,
        y: mousePosition().y,
      },
      size: {
        x: 100,
        y: 100,
      },
      title: "",
      contents: "",
    });
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
          style={{
            position: "absolute",
            transform: `translate3d(${position().x}px, ${
              position().y
            }px, 0) scale(${scale()})`,
          }}
        >
          <For each={visibleCards()}>
            {(card) => <Card card={card} scaleFactor={scale} />}
          </For>
        </div>
      </StyledCardContainer>
      <div class={style({ position: "absolute", left: 0, top: 0 })}>
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
    backgroundImage:
      `linear-gradient(to right, #eee 1px, transparent 1px),` +
      `linear-gradient(to bottom, #eee 1px, #fcfcfc 1px)`,
  },
});
