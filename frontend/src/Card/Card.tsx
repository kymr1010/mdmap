import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  For,
  JSX,
  onMount,
  Setter,
  Show,
} from "solid-js";
import { styled } from "@macaron-css/solid";
import type { Card, Dir, Dir8 } from "../schema/Card.js";
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
import { CardConnector, CardConnectorPoint } from "../schema/Connrctor.js";
import { inputManager } from "../input/manager";

export interface CardProps {
  mousePosition: Accessor<Dimmension>;
  nodePosition: Accessor<Dimmension>;
  setNodePosition: Setter<Dimmension>;
  cardPosition: Accessor<Dimmension>;
  card: Accessor<Card>;
  setCard: (card: Card) => void;
  scaleFactor: Accessor<number>;
  setEdittingCard: Setter<Card | null>;
  isMinimized: Accessor<boolean>;
  onToggleMinimize: (id: number) => void;
  onOpenPage: (id: number) => void;
  startConnect: (
    e: PointerEvent,
    pos: Dimmension,
    cardId: number,
    dir: Dir
  ) => void;
  onHover: (c: Card) => void;
  onLeave: () => void;
  onNearestConnector: (cardConnectorPoint: CardConnectorPoint) => void;
  onMove: (pos: Dimmension) => void;
  onUpdateCard?: (card: Card) => void;
  onDelete?: (id: number) => void;
  onDisconnectFromParent?: (id: number) => void;
}

export const CardElm = (props: CardProps) => {
  let ref!: HTMLDivElement;
  let cardRoot!: HTMLDivElement;
  let contentRef!: HTMLDivElement;

  const [size, setSize] = createSignal<Dimmension>({ ...props.card().size });
  const [title, setTitle] = createSignal(props.card().title);
  const [tags, setTags] = createSignal(props.card().tag_ids);
  const [contents, setContents] = createSignal(props.card().contents);
  const [isEditing, setIsEditing] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);

  const menuItems: MenuItem[] = [
    { label: "コピー", action: () => console.log("コピーしました") },
    { label: "最小化/復元", action: () => props.onToggleMinimize(props.card().id) },
    { label: "ページ表示", action: () => props.onOpenPage(props.card().id) },
    {
      label: "編集",
      action: () => {
        setIsEditing(true);
        props.setEdittingCard(props.card());
      },
    },
    ...(props.card().parent_id != null
      ? [
          {
            label: "接続解除",
            action: () => props.onDisconnectFromParent?.(props.card().id),
          } as MenuItem,
        ]
      : []),
    {
      label: "削除",
      action: () => props.onDelete?.(props.card().id),
    },
  ];
  const { onContextMenu, ContextMenu } = useContextMenu(menuItems);
  const dirs = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
  const handles = {} as Record<(typeof dirs)[number], HTMLDivElement>;

  // ドラッグ＆リサイズフックをマウント時に適用
  onMount(() => {
    // Drag by header bar
    useDrag({
      ref: () => ref,
      getPos: props.nodePosition,
      setPos: props.setNodePosition,
      scaleFactor: props.scaleFactor,
      moveCallback: props.onMove,
      // Allow dragging when clicking on children like h1 in header
      strictTarget: false,
      startGuard: (e) =>
        !props.isMaximized() && inputManager.canStartPointerDrag({
          when: "card",
          action: "card.move",
          root: cardRoot,
          event: e,
        }),
      upCallback: (diff: Dimmension) => {
        const newCard = {
          ...props.card(),
          // send absolute to container; it will convert to relative
          position: props.nodePosition(),
        };
        if (props.onUpdateCard) {
          props.onUpdateCard(newCard);
        } else {
          // fallback: persist as-is
          updateCard(newCard);
        }
      },
    });
  });

  // Attach resize handles only when rendered (not minimized)
  createEffect(() => {
    if (props.isMinimized()) return;
    dirs.forEach((dir) => {
      const el = handles[dir];
      if (!el) return;
      useResize(
        el,
        dir,
        props.nodePosition,
        props.setNodePosition,
        size,
        setSize,
        props.scaleFactor,
        (diff: Dimmension) => {
          const newCard: Card = {
            ...props.card(),
            // send absolute to container; it will convert to relative
            position: props.nodePosition(),
            size: size(),
          };
          if (props.onUpdateCard) {
            props.onUpdateCard(newCard);
          } else {
            updateCard(newCard);
          }
        }
      );
    });
  });

  // Enable dragging by the first H1 inside content (from markdown)
  createEffect(() => {
    // Depend on contents so effect re-runs when markdown changes
    contents();
    if (props.isMinimized()) return;
    useDrag({
      ref: () => (contentRef ? (contentRef.querySelector("h1") as HTMLElement | null) : null),
      getPos: props.nodePosition,
      setPos: props.setNodePosition,
      scaleFactor: props.scaleFactor,
      moveCallback: props.onMove,
      // Allow clicks on descendants within the H1 if any
      strictTarget: false,
      startGuard: (e) =>
        inputManager.canStartPointerDrag({
          when: "card",
          action: "card.move",
          root: cardRoot,
          event: e,
        }),
      upCallback: () => {
        const newCard = {
          ...props.card(),
          position: props.nodePosition(),
        };
        if (props.onUpdateCard) {
          props.onUpdateCard(newCard);
        } else {
          updateCard(newCard);
        }
      },
    });
  });

  // createEffect(() => setPosition({ ...props.card().position }));
  createEffect(() => setSize({ ...props.card().size }));

  const handleSaveCard = () => {
    updateCard({
      id: props.card().id,
      position: position(),
      size: size(),
      title: title(),
      contents: contents(),
      tag_ids: [],
      parent_id: props.card().parent_id,
    });
  };

  const computeConnectHandles = (): { dir: Dir; pos: Dimmension }[] => {
    const w = size().x,
      h = size().y;
    const centerX = w / 2,
      centerY = h / 2;
    return [
      {
        dir: "n",
        pos: { x: centerX + props.cardPosition().x, y: props.cardPosition().y },
      },
      {
        dir: "s",
        pos: {
          x: centerX + props.cardPosition().x,
          y: h + props.cardPosition().y,
        },
      },
      {
        dir: "e",
        pos: {
          x: w + props.cardPosition().x,
          y: centerY + props.cardPosition().y,
        },
      },
      {
        dir: "w",
        pos: { x: props.cardPosition().x, y: centerY + props.cardPosition().y },
      },
    ];
  };

  return (
    <>
      <StyledCard
        ref={(el) => (cardRoot = el)}
        onContextMenu={onContextMenu}
        onMouseEnter={() => {
          setIsHovered(true);
          props.onHover(props.card());
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
          // Node の位置によって決まるのでここでは指定不要
          // left: `${pos().x}px`,
          // top: `${pos().y}px`,
          width: `${size().x}px`,
          height: props.isMinimized() ? undefined : `${size().y}px`,
        }}
        macaronHover={isHovered() ? "hover" : undefined}
      >
        <StyledCardHeader ref={(el) => (ref = el)} class="card-header">
          {props.isMinimized() && (
            <div style={{ fontWeight: 600, overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
              {props.card().title || "(untitled)"}
            </div>
          )}
        </StyledCardHeader>
        <Show when={!props.isMinimized()}>
          <StyledCardContent>
            <div ref={(el) => (contentRef = el)}>
              <div
                class="markdown-body"
                innerHTML={DOMPurify.sanitize(marked(contents() || "")) || ""}
              ></div>
            </div>
            {dirs.map((dir) => (
              <div
                ref={(el) => (handles[dir] = el!)}
                class="resize-handle"
                style={getHandleStyle(dir, size())}
              />
            ))}
            {computeConnectHandles().map(({ dir, pos }) => (
              <div
                class="connect-handle"
                data-dir={dir}
                onPointerDown={(e) => props.startConnect(e, pos, props.card().id, dir)}
                onMouseEnter={() =>
                  props.onNearestConnector({
                    dir,
                    cardId: props.card().id,
                  })
                }
                style={getConnectHandleStyle(dir, size(), isHovered)}
              />
            ))}
          </StyledCardContent>
        </Show>
        <Show when={!props.isMinimized()}>
          <StyledCardFooter>
            <p> {props.card().id} -&gt; {props.card().parent_id}</p>
            <p>{props.card().created_at}</p>
            <p>{props.card().updated_at}</p>
            {/* Tag editing moved to EditorPanel */}
          </StyledCardFooter>
        </Show>
      </StyledCard>

      <Portal>
        <ContextMenu />
      </Portal>
    </>
  );
};

const getHandleStyle = (
  direction: string,
  size: Dimmension
): JSX.CSSProperties => {
  const half = 0;
  const handleSize = 10;
  const cursorMap: Record<Dir8, string> = {
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    nw: "nwse-resize",
    se: "nwse-resize",
  };
  const styles: Record<string, JSX.CSSProperties> = {
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
    "z-index": 1000,
    cursor: cursorMap[direction],
    width: `${handleSize}px`,
    height: `${handleSize}px`,
    ...styles[direction],
  };
};

const CONNECT_HANDLE_SIZE = 20;
const getConnectHandleStyle = (
  direction: Dir,
  size: Dimmension,
  isHoverd: () => boolean
): JSX.CSSProperties => {
  const half = CONNECT_HANDLE_SIZE / 2;
  const centerX = size.x / 2 - half;
  const centerY = size.y / 2 - half;

  const base: JSX.CSSProperties = {
    position: "absolute",
    display: isHoverd() ? "block" : "none",
    width: `${CONNECT_HANDLE_SIZE}px`,
    height: `${CONNECT_HANDLE_SIZE}px`,
    "border-radius": `${CONNECT_HANDLE_SIZE / 2}px`,
    cursor: "crosshair",
    "z-index": 1001,
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
    minHeight: "1rem",
    cursor: "grab",
  },
});

const StyledCardFooter = styled("div", {
  base: {
    width: "100%",
    marginTop: "auto",
  },
});

const StyledCardContent = styled("div", {
  base: {
    overflow: "hidden",
    width: "100%",
    height: "100%",
    flexGrow: 1,
    // Local override: show grab cursor on markdown H1 for drag affordance
    "& .markdown-body h1": {
      cursor: "grab",
    },
  },
});
