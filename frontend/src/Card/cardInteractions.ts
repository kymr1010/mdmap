import { Accessor, createEffect, onMount, Setter } from "solid-js";
import type { Card, Dir } from "../schema/Card.js";
import type { CardConnectorPoint } from "../schema/Connrctor.js";
import type { Dimmension } from "../schema/Point.js";
import { updateCard } from "../hooks/useCardAPI.js";
import { MenuItem } from "../hooks/useContextMenu.js";
import { useDrag } from "../hooks/useDrag.js";
import { useResize } from "../hooks/useResize.js";
import { inputManager } from "../input/manager";
import type { CardProps } from "./types.js";
import { resizeDirs } from "./cardStyles.js";

type CommonInteractionOptions = {
  cardRoot: Accessor<HTMLDivElement | undefined>;
  dragHandle: Accessor<HTMLElement | undefined>;
  h1DragRoot?: Accessor<HTMLDivElement | undefined>;
  h1DragDependency?: Accessor<unknown>;
  size: Accessor<Dimmension>;
  setSize: Setter<Dimmension>;
  resizeHandles: Record<(typeof resizeDirs)[number], HTMLDivElement | undefined>;
};

export const persistCardUpdate = (props: CardProps, card: Card) => {
  if (props.onUpdateCard) {
    props.onUpdateCard(card);
  } else {
    updateCard(card);
  }
};

export const createCommonMenuItems = (
  props: CardProps,
  typeItems: () => MenuItem[] = () => []
): MenuItem[] => [
  ...typeItems(),
  { label: "コピー", action: () => console.log("コピーしました") },
  { label: "最小化/復元", action: () => props.onToggleMinimize(props.card().id) },
  { label: "ページ表示", action: () => props.onOpenPage(props.card().id) },
  ...(props.canEdit()
    ? [
        {
          label: "編集",
          action: () => props.setEdittingCard(props.card()),
        } as MenuItem,
      ]
    : []),
  ...(props.canEdit() && props.card().parent_id != null
    ? [
        {
          label: "接続解除",
          action: () => props.onDisconnectFromParent?.(props.card().id),
        } as MenuItem,
      ]
    : []),
  ...(props.canEdit()
    ? [
        {
          label: "削除",
          action: () => props.onDelete?.(props.card().id),
        } as MenuItem,
      ]
    : []),
];

export const useCommonCardInteractions = (
  props: CardProps,
  options: CommonInteractionOptions
) => {
  const persistPosition = () => {
    persistCardUpdate(props, {
      ...props.card(),
      position: props.nodePosition(),
    });
  };

  onMount(() => {
    useDrag({
      ref: options.dragHandle,
      getPos: props.nodePosition,
      setPos: props.setNodePosition,
      scaleFactor: props.scaleFactor,
      moveCallback: props.onMove,
      strictTarget: false,
      startGuard: (e) =>
        props.canEdit() &&
        inputManager.canStartPointerDrag({
          when: "card",
          action: "card.move",
          root: options.cardRoot(),
          event: e,
        }),
      upCallback: persistPosition,
    });
  });

  createEffect(() => {
    if (props.isMinimized()) return;
    if (!props.canEdit()) return;
    resizeDirs.forEach((dir) => {
      const el = options.resizeHandles[dir];
      if (!el) return;
      useResize(
        el,
        dir,
        props.nodePosition,
        props.setNodePosition,
        options.size,
        options.setSize,
        props.scaleFactor,
        () => {
          persistCardUpdate(props, {
            ...props.card(),
            position: props.nodePosition(),
            size: options.size(),
          });
        }
      );
    });
  });

  createEffect(() => options.setSize({ ...props.card().size }));

  createEffect(() => {
    options.h1DragDependency?.();
    const root = options.h1DragRoot?.();
    if (!root) return;
    if (props.isMinimized()) return;
    useDrag({
      ref: () => root.querySelector("h1") as HTMLElement | null,
      getPos: props.nodePosition,
      setPos: props.setNodePosition,
      scaleFactor: props.scaleFactor,
      moveCallback: props.onMove,
      strictTarget: false,
      startGuard: (e) =>
        props.canEdit() &&
        inputManager.canStartPointerDrag({
          when: "card",
          action: "card.move",
          root: options.cardRoot(),
          event: e,
        }),
      upCallback: persistPosition,
    });
  });
};

export const computeConnectHandles = (
  size: Dimmension,
  cardPosition: Dimmension
): { dir: Dir; pos: Dimmension }[] => {
  const centerX = size.x / 2;
  const centerY = size.y / 2;
  return [
    { dir: "n", pos: { x: centerX + cardPosition.x, y: cardPosition.y } },
    { dir: "s", pos: { x: centerX + cardPosition.x, y: size.y + cardPosition.y } },
    { dir: "e", pos: { x: size.x + cardPosition.x, y: centerY + cardPosition.y } },
    { dir: "w", pos: { x: cardPosition.x, y: centerY + cardPosition.y } },
  ];
};

export const notifyNearestConnector = (
  props: Pick<CardProps, "onNearestConnector">,
  point: CardConnectorPoint
) => props.onNearestConnector(point);
