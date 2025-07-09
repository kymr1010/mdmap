// src/components/Card.tsx
import {
  Accessor,
  createEffect,
  createSignal,
  For,
  JSX,
  onMount,
  Setter,
  Show,
} from "solid-js";
import { styled } from "@macaron-css/solid";
import type { Card } from "../schema/Card.js";
import { useDrag } from "../hooks/useDrag.js";
import { Dimmension } from "../schema/Point.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useResize } from "../hooks/useResize.js";
import { CSSProperties, style } from "@macaron-css/core";
import { MenuItem, useContextMenu } from "../hooks/useContextMenu.js";
import { Portal } from "solid-js/web";
import { updateCard } from "../hooks/useCardAPI.js";
import { EditorPanel } from "../EditorPanel/EditorPanel.jsx";
import { TagInput } from "../Tag/Tag.jsx";

export interface CardProps {
  mousePosition: Accessor<Dimmension>;
  card: Card;
  setCard: (card: Card) => void;
  scaleFactor: Accessor<number>;
  setEdittingCard: Setter<Card | undefined>;
  startConnect: (e: PointerEvent, pos: Dimmension, cardId: number) => void;
  onHover: (c: Card) => void;
  onLeave: () => void;
  onNearestConnector: (
    pos: Dimmension,
    dir: string,
    cardId: Card["id"]
  ) => void;
  onMove: (pos: Dimmension) => void;
}

export const CardElm = (props: CardProps) => {
  let ref!: HTMLDivElement;

  const [pos, setPos] = createSignal<Dimmension>({ ...props.card.position });
  const [size, setSize] = createSignal<Dimmension>({ ...props.card.size });
  const [title, setTitle] = createSignal(props.card.title);
  const [tags, setTags] = createSignal(props.card.tag_ids);
  const [contents, setContents] = createSignal(props.card.contents);
  const [isEditing, setIsEditing] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);

  const menuItems: MenuItem[] = [
    { label: "コピー", action: () => console.log("コピーしました") },
    {
      label: "編集",
      action: () => {
        setIsEditing(true);
        props.setEdittingCard(props.card);
      },
    },
    { label: "削除", action: () => console.log("削除しました") },
  ];
  const { onContextMenu, ContextMenu } = useContextMenu(menuItems);
  const dirs = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
  const handles = {} as Record<(typeof dirs)[number], HTMLDivElement>;

  // ドラッグ＆リサイズフックをマウント時に適用
  onMount(() => {
    useDrag({
      ref,
      getPos: pos,
      setPos: setPos,
      scaleFactor: props.scaleFactor,
      mousePosition: props.mousePosition,
      moveCallback: (diff: Dimmension) => {},
      upCallback: (diff: Dimmension) => {
        const newCard = {
          id: props.card.id,
          position: pos(),
          size: size(),
          title: title(),
          tag_ids: tags(),
          contents: contents(),
          card_ids: [],
        };
        props.setCard(newCard);
        updateCard(newCard);
      },
    });
    dirs.forEach((dir) =>
      useResize(
        handles[dir],
        dir,
        pos,
        setPos,
        size,
        setSize,
        props.scaleFactor,
        () => {
          const newCard = {
            id: props.card.id,
            position: pos(),
            size: size(),
            title: title(),
            contents: contents(),
            tag_ids: tags(),
            card_ids: [],
          };
          props.setCard(newCard);
          updateCard(newCard);
        }
      )
    );
  });

  // 外部 props.card が変わったら反映
  createEffect(() => setPos({ ...props.card.position }));
  createEffect(() => setSize({ ...props.card.size }));
  // （title/contents はユーザー編集で overwrite するので同期しない）

  const handleSaveCard = () => {
    updateCard({
      id: props.card.id,
      position: pos(),
      size: size(),
      title: title(),
      contents: contents(),
      tag_ids: [],
      parent_id: props.card.parent_id,
    });
  };

  const computeConnectHandles = (): { dir: string; x: number; y: number }[] => {
    const w = size().x,
      h = size().y;
    const centerX = w / 2,
      centerY = h / 2;
    return [
      { dir: "n", x: centerX + pos().x, y: pos().y },
      { dir: "s", x: centerX + pos().x, y: h + pos().y },
      { dir: "e", x: w + pos().x, y: centerY + pos().y },
      { dir: "w", x: pos().x, y: centerY + pos().y },
    ];
  };

  return (
    <>
      <StyledCard
        onContextMenu={onContextMenu}
        onMouseEnter={() => {
          setIsHovered(true);
          props.onHover(props.card);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          console.log("Card.onMouseLeave");
          props.onLeave();
        }}
        onPointerDown={(e) => {
          console.log("Card.onPointerDown");
        }}
        style={{
          position: "absolute",
          left: `${pos().x}px`,
          top: `${pos().y}px`,
          width: `${size().x}px`,
          height: `${size().y}px`,
        }}
        macaronHover={isHovered() ? "hover" : undefined}
      >
        <StyledCardHeader ref={ref}></StyledCardHeader>
        <StyledCardContent>
          <div>
            <h1>{title()}</h1>
            <p>
              x:{pos().x}, y:{pos().y}
            </p>
            <div class={style({ overflowX: "auto" })}>{<TagInput />}</div>
            <div
              innerHTML={DOMPurify.sanitize(marked(contents() || "")) || ""}
            ></div>
            <p>{props.card.id}</p>
          </div>
          {dirs.map((dir) => (
            <div
              ref={(el) => (handles[dir] = el!)}
              class="resize-handle"
              style={getHandleStyle(dir, size())}
            />
          ))}
          {computeConnectHandles().map(({ dir, x, y }) => (
            <div
              class="connect-handle"
              data-dir={dir}
              onPointerDown={(e) =>
                props.startConnect(e, { x, y }, props.card.id)
              }
              onMouseEnter={(e) =>
                props.onNearestConnector({ x, y }, dir, props.card.id)
              }
              style={getConnectHandleStyle(dir, size(), isHovered)}
            />
          ))}
        </StyledCardContent>
      </StyledCard>

      <Portal>
        <ContextMenu />
      </Portal>
    </>
  );
};

const getHandleStyle = (direction: string, size: Dimmension): CSSProperties => {
  const half = 0;
  const handleSize = 10;
  const cursorMap: Record<string, string> = {
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    nw: "nwse-resize",
    se: "nwse-resize",
  };
  const styles: Record<string, CSSProperties> = {
    n: {
      top: `${half}px`,
      left: `${handleSize}px`,
      height: `${handleSize}px`,
      width: `${size.x - 2 * handleSize}px`,
    },
    s: {
      bottom: `${half}px`,
      left: `${handleSize}px`,
      height: `${handleSize}px`,
      width: `${size.x - 2 * handleSize}px`,
    },
    e: {
      top: `${handleSize}px`,
      right: `${half}px`,
      height: `${size.y - 2 * handleSize}px`,
      width: `${handleSize}px`,
    },
    w: {
      top: `${handleSize}px`,
      left: `${half}px`,
      height: `${size.y - 2 * handleSize}px`,
      width: `${handleSize}px`,
    },
    ne: {
      top: `${half}px`,
      right: `${half}px`,
      height: `${handleSize}px`,
      width: `${handleSize}px`,
    },
    nw: {
      top: `${half}px`,
      left: `${half}px`,
      height: `${handleSize}px`,
      width: `${handleSize}px`,
    },
    se: {
      bottom: `${half}px`,
      right: `${half}px`,
      height: `${handleSize}px`,
      width: `${handleSize}px`,
    },
    sw: {
      bottom: `${half}px`,
      left: `${half}px`,
      height: `${handleSize}px`,
      width: `${handleSize}px`,
    },
  };
  return {
    position: "absolute",
    zIndex: 1000,
    cursor: cursorMap[direction],
    backgroundColor: "#4A90E2",
    width: `${handleSize}px`,
    height: `${handleSize}px`,
    ...styles[direction],
  };
};

const CONNECT_HANDLE_SIZE = 20;
const getConnectHandleStyle = (
  direction: "n" | "e" | "s" | "w",
  size: Dimmension,
  isHoverd: () => boolean
): CSSProperties => {
  const half = CONNECT_HANDLE_SIZE / 2;
  const centerX = size.x / 2 - half;
  const centerY = size.y / 2 - half;

  const base: CSSProperties = {
    position: "absolute",
    display: isHoverd() ? "block" : "none",
    width: `${CONNECT_HANDLE_SIZE}px`,
    height: `${CONNECT_HANDLE_SIZE}px`,
    "border-radius": `${CONNECT_HANDLE_SIZE / 2}px`,
    cursor: "crosshair",
    zIndex: 1000,
    background: "#888",
  };

  switch (direction) {
    case "n":
      return {
        ...base,
        top: `-${half}px`,
        left: `${centerX}px`,
      };
    case "s":
      return {
        ...base,
        bottom: `-${half}px`,
        left: `${centerX}px`,
      };
    case "e":
      return {
        ...base,
        right: `-${half}px`,
        top: `${centerY}px`,
      };
    case "w":
      return {
        ...base,
        left: `-${half}px`,
        top: `${centerY}px`,
      };
    default:
      return base;
  }
};

const StyledCard = styled("div", {
  base: {
    position: "absolute",
    backgroundColor: "white",
    boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
    borderRadius: "0.75rem",
    padding: "0.75rem",
    touchAction: "none",
    userSelect: "none",
    display: "flex",
    flexDirection: "column",
    zIndex: 1000,
    "& li": {
      listStyle: "disc",
      marginLeft: "1rem",
    },
  },
  variants: {
    macaronHover: {
      hover: {
        zIndex: 1001,
        boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.3)",
      },
    },
  },
});

const StyledCardHeader = styled("div", {
  base: {
    width: "100%",
    height: "1rem",
  },
});

const StyledCardContent = styled("div", {
  base: {
    overflow: "hidden",
    width: "100%",
    height: "100%",
    flexGrow: 1,
  },
});
