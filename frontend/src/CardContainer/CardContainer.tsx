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
  onCleanup,
  Setter,
  Show,
} from "solid-js";
import { Card, Dir } from "../schema/Card.js";
import { Dimmension } from "../schema/Point.js";
import { useDrag } from "../hooks/useDrag.js";
import { style } from "@macaron-css/core";
import { useContextMenu } from "../hooks/useContextMenu.jsx";
import { createCard, getCards, updateCard } from "../hooks/useCardAPI.js";
import { deleteCard as deleteCardAPI } from "../hooks/useCardAPI.js";
import { useConnector } from "../hooks/useConnector.js";
import { calcRelaxConnectorCtrls, PathElm } from "../Connector/Connector.jsx";
import {
  CardConnector,
  CardConnectorPoint,
  Path,
} from "../schema/Connrctor.js";
import { attachChildToParent, connectCards, disconnectCards } from "../hooks/useConnectAPI.js";
import { CardRelation } from "../schema/CardRelation.js";
import { CardElm } from "../Card/Card.jsx";
import {
  ORIGIN,
  subtractPos,
  withParentFromAbs,
  withStoredPosFromAbs,
  withoutParentFromAbs,
  getAbsPosFromMap,
} from "../utils/position.js";
import { extractFirstH1 } from "../utils/markdown.js";
import { PageView } from "../PageView/PageView.jsx";
import { inputManager } from "../input/manager.js";
import { createLongPressContextMenu } from "../input/gestures.js";
import { isPrivateCard, PrivateMark } from "../Card/PrivateMark.jsx";
import { MarkdownBody } from "../Markdown/MarkdownBody.jsx";

export interface CardContainerProps {
  position: Dimmension;
  cards: Accessor<Card[]>;
  setCards: Setter<Card[]>;
  cardRelations: Accessor<CardRelation[]>;
  setCardRelations: Setter<CardRelation[]>;
  setEdittingCard: Setter<Card | null>;
  canEdit: Accessor<boolean>;
  onMouseWorldPositionChange?: (position: Dimmension) => void;
  // Optional: id to reveal/center on canvas
  revealCardId?: Accessor<number | null>;
  // Optional: allow container to request a reveal (e.g., from URL)
  onRequestReveal?: (id: number) => void;
}

export const CardContainer = (props: CardContainerProps) => {
  const MINIMIZED_HEIGHT = 32; // px, visual height of minimized card header
  let ref!: HTMLDivElement;
  let containerRef: HTMLDivElement | undefined;
  const tileSize = 2000;

  const [scale, setScale] = createSignal<number>(1);
  const [zoomLevel, setZoomLevel] = createSignal<number>(0);
  const [isPinching, setIsPinching] = createSignal(false);
  const [showOkCountColor, setShowOkCountColor] = createSignal(false);

  const ZOOM = {
    MAX: 5,
    MIN: -10,
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

  createEffect(() => {
    props.onMouseWorldPositionChange?.(fixedMousePosition());
  });

  const [position, setPosition] = createSignal<Dimmension>({
    x: props.position.x,
    y: props.position.y,
  });
  const [tiles, setTiles] = createSignal<Record<string, Array<number>>>({});
  const [nowTile, setNowTile] = createSignal<string>("0,0");
  const [minimized, setMinimized] = createSignal<Set<number>>(new Set());
  const [pageViewId, setPageViewId] = createSignal<number | null>(null);
  const [pendingRevealId, setPendingRevealId] = createSignal<number | null>(null);
  const [hiddenLinkedCardIds, setHiddenLinkedCardIds] = createSignal<Set<number>>(new Set());
  const [linkPreview, setLinkPreview] = createSignal<{
    cardId: Card["id"];
    position: Dimmension;
  } | null>(null);
  const touchPointers = new Map<number, Dimmension>();
  const longPress = createLongPressContextMenu();
  let pinchStart:
    | {
        distance: number;
        scale: number;
        position: Dimmension;
        center: Dimmension;
      }
    | null = null;

  // Compute a quick id->card map for lookups
  const cardMap = () => new Map(props.cards().map((c) => [c.id, c] as const));

  // Live absolute position registry for each card (for following + connectors)
  const posGetters = new Map<number, Accessor<Dimmension>>();
  const posSetters = new Map<number, Setter<Dimmension>>();
  const lastDragDelta = new Map<number, Dimmension>();

  // Minimize helpers
  const isCardVisible = (id: number) => {
    if (hiddenLinkedCardIds().has(id)) return false;
    // visible if no ancestor is minimized
    const map = cardMap();
    let cur = map.get(id);
    while (cur && cur.parent_id != null) {
      if (minimized().has(cur.parent_id)) return false;
      cur = map.get(cur.parent_id);
    }
    return true;
  };

  const isMinimized = (id: number) => minimized().has(id);
  const toggleMinimize = (id: number) => {
    setMinimized((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pushUrlForCard = (id: number) => {
    try {
      window.history.pushState({ cardId: id }, "", `/card/${id}/view`);
    } catch {}
  };
  const pushUrlHome = () => {
    try {
      window.history.pushState({}, "", `/`);
    } catch {}
  };
  const openPage = (id: number) => {
    setLinkPreview(null);
    setPageViewId(id);
    pushUrlForCard(id);
  };
  const closePage = () => {
    const id = pageViewId();
    setPageViewId(null);
    if (id != null) {
      try {
        window.history.pushState({ cardId: id }, "", `/card/${id}`);
      } catch {}
    } else {
      pushUrlHome();
    }
  };

  const parsePath = (): { kind: "view" | "page" | null; id: number | null } => {
    const path = window.location.pathname;
    let m = path.match(/^\/card\/(\d+)\/view$/);
    if (m) {
      const n = Number(m[1]);
      return { kind: "view", id: Number.isFinite(n) ? n : null };
    }
    m = path.match(/^\/card\/(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      return { kind: "page", id: Number.isFinite(n) ? n : null };
    }
    return { kind: null, id: null };
  };

  onMount(() => {
    const initial = parsePath();
    if (initial.kind === "view" && initial.id != null) setPageViewId(initial.id);
    if (initial.kind === "page" && initial.id != null) {
      props.onRequestReveal?.(initial.id);
      setPendingRevealId(initial.id);
    }
    const handler = () => {
      const p = parsePath();
      if (p.kind === "view") {
        setPageViewId(p.id);
      } else if (p.kind === "page") {
        setPageViewId(null);
        if (p.id != null) {
          props.onRequestReveal?.(p.id);
          setPendingRevealId(p.id);
        }
      } else {
        setPageViewId(null);
        setLinkPreview(null);
      }
    };
    window.addEventListener("popstate", handler);
    onCleanup(() => window.removeEventListener("popstate", handler));
  });

  onMount(() => {
    const closePreview = (event: PointerEvent) => {
      if (!linkPreview()) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-linked-card-preview]")) return;
      setLinkPreview(null);
    };
    window.addEventListener("pointerdown", closePreview, true);
    onCleanup(() => window.removeEventListener("pointerdown", closePreview, true));
  });

  const { currentLine, startConnect } = useConnector({
    mousePosition: fixedMousePosition,
    onUpCallback: async (fromID: Card["id"]) => {
      if (!props.canEdit()) return;

      const parentConnPoint = nearestConnector();
      const childConnPoint = connectStartedConnector();
      console.log("onUpCallback", parentConnPoint);

      if (!childConnPoint) return;

      if (!parentConnPoint) {
        try {
          await createChildCardFromConnector(childConnPoint, fixedMousePosition());
        } catch (e) {
          console.error(e);
        } finally {
          setConnectStartedConnector(null);
          setNearestConnector(null);
        }
        return;
      }

      const parentId = parentConnPoint.cardId;
      const childId = fromID;
      const childCard = cardMap().get(childId);
      if (!childCard) return;
      const connector: CardConnector = {
        parent: parentConnPoint,
        child: childConnPoint,
        c: {
          parent: parentConnPoint,
          child: childConnPoint,
        },
      };

      connectCards(parentId, childId, connector).then((res) => {
        const childAbs = getAbsPos(childId);
        const newChildCard = withParentFromAbs(cardMap(), childCard, parentId, childAbs);
        appendRelation({ parent_id: parentId, child_id: childId, connector });
        replaceCard(newChildCard);
        updateCard(newChildCard);
        // Clear temp connector states
        setConnectStartedConnector(null);
        setNearestConnector(null);
      }).catch(console.error);
    },
  });

  const { onContextMenu, ContextMenu } = useContextMenu(() => [
    ...(props.canEdit()
      ? [
          { label: "作成", action: () => addCard() },
          { label: "作成", action: () => console.log("作成しました") },
        ]
      : []),
  ]);

  const [hoveredCard, setHoveredCard] = createSignal<Card | null>(null);
  const [connectStartedConnector, setConnectStartedConnector] =
    createSignal<CardConnectorPoint | null>(null);
  const [nearestConnector, setNearestConnector] =
    createSignal<CardConnectorPoint | null>(null);

  const oppositeDir = (dir: Dir): Dir => {
    switch (dir) {
      case "n":
        return "s";
      case "s":
        return "n";
      case "e":
        return "w";
      case "w":
        return "e";
    }
  };

  const getCardPositionFromConnectorPoint = (
    point: Dimmension,
    dir: Dir,
    size: Dimmension
  ): Dimmension => {
    switch (dir) {
      case "n":
        return { x: point.x - size.x / 2, y: point.y };
      case "s":
        return { x: point.x - size.x / 2, y: point.y - size.y };
      case "e":
        return { x: point.x - size.x, y: point.y - size.y / 2 };
      case "w":
        return { x: point.x, y: point.y - size.y / 2 };
    }
  };

  const screenToWorld = (point: Dimmension): Dimmension => ({
    x: Math.floor((point.x - position().x) / scale()),
    y: Math.floor((point.y - position().y) / scale()),
  });

  const replaceFirstNewCardLink = (contents: string, cardId: Card["id"]) =>
    contents.replace("/card/new", `/card/${cardId}`);

  const getPreviewScreenPosition = (
    sourceCardId: Card["id"] | null,
    screenPosition: Dimmension,
    anchorRect?: DOMRect
  ): Dimmension => {
    const clampValue = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const pointDistance = (a: Dimmension, b: Dimmension) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const previewSize = { x: 320, y: 360 };
    const margin = 12;
    const viewport = { x: window.innerWidth, y: window.innerHeight };
    const source = sourceCardId == null ? undefined : cardMap().get(sourceCardId);
    const sourceAbs = source ? getAbsPos(source.id) : null;
    const avoid = source && sourceAbs
      ? {
          left: position().x + sourceAbs.x * scale(),
          top: position().y + sourceAbs.y * scale(),
          right: position().x + (sourceAbs.x + source.size.x) * scale(),
          bottom: position().y + (sourceAbs.y + source.size.y) * scale(),
        }
      : anchorRect
        ? {
            left: anchorRect.left,
            top: anchorRect.top,
            right: anchorRect.right,
            bottom: anchorRect.bottom,
          }
        : {
            left: screenPosition.x,
            top: screenPosition.y,
            right: screenPosition.x,
            bottom: screenPosition.y,
          };

    const clampPoint = (p: Dimmension): Dimmension => ({
      x: clampValue(p.x, margin, viewport.x - previewSize.x - margin),
      y: clampValue(p.y, margin, viewport.y - previewSize.y - margin),
    });
    const overlaps = (p: Dimmension) =>
      p.x < avoid.right &&
      p.x + previewSize.x > avoid.left &&
      p.y < avoid.bottom &&
      p.y + previewSize.y > avoid.top;
    const candidates = [
      { x: avoid.right + margin, y: screenPosition.y - 28 },
      { x: avoid.left - previewSize.x - margin, y: screenPosition.y - 28 },
      { x: screenPosition.x - previewSize.x / 2, y: avoid.bottom + margin },
      { x: screenPosition.x - previewSize.x / 2, y: avoid.top - previewSize.y - margin },
    ].map(clampPoint);

    candidates.sort(
      (a, b) =>
        pointDistance(a, screenPosition) - pointDistance(b, screenPosition)
    );
    return candidates.find((p) => !overlaps(p)) ?? candidates[0];
  };

  const hrefFromCardLinkClick = (event: MouseEvent): {
    href: string;
    anchorRect: DOMRect;
  } | null => {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const link = target.closest("a");
    if (!(link instanceof HTMLAnchorElement)) return null;

    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (!/^\/card\/(?:new|\d+)$/.test(url.pathname)) return null;
    return { href: url.pathname, anchorRect: link.getBoundingClientRect() };
  };

  const handleLinkedMarkdownClick = (
    sourceCardId: Card["id"],
    event: MouseEvent
  ) => {
    const link = hrefFromCardLinkClick(event);
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    openLinkedCardPreview(sourceCardId, link.href, {
      x: event.clientX,
      y: event.clientY,
    }, link.anchorRect);
  };

  const openLinkedCardPreview = async (
    sourceCardId: Card["id"],
    href: string,
    screenPosition: Dimmension,
    anchorRect?: DOMRect
  ) => {
    const previewPosition = getPreviewScreenPosition(
      sourceCardId,
      screenPosition,
      anchorRect
    );

    if (href === "/card/new") {
      if (!props.canEdit()) return;
      const source = cardMap().get(sourceCardId);
      if (!source) return;

      const sourceAbs = getAbsPos(sourceCardId);
      const previewWorldPosition = screenToWorld({
        x: previewPosition.x,
        y: previewPosition.y,
      });
      const draftCard = {
        id: 0,
        position: subtractPos(previewWorldPosition, sourceAbs),
        size: { x: 260, y: 180 },
        title: "",
        contents: "",
        parent_id: sourceCardId,
        visibility: source.visibility ?? "public",
        tag_ids: [],
      };

      try {
        const created = await createCard(draftCard);
        const childCard: Card = {
          ...created,
          parent_id: sourceCardId,
          position: created.position,
        };
        const nextSource: Card = {
          ...source,
          contents: replaceFirstNewCardLink(source.contents ?? "", created.id),
        };

        props.setCards((prev) =>
          prev.map((c) => (c.id === sourceCardId ? nextSource : c)).concat(childCard)
        );
        appendRelation({ parent_id: sourceCardId, child_id: created.id, connector: null });
        setHiddenLinkedCardIds((prev) => new Set(prev).add(created.id));
        setLinkPreview({
          cardId: created.id,
          position: previewPosition,
        });

        await attachChildToParent(sourceCardId, created.id);
        await updateCard(nextSource);
      } catch (e) {
        console.error(e);
      }
      return;
    }

    const match = href.match(/^\/card\/(\d+)$/);
    if (!match) return;
    const cardId = Number(match[1]);
    if (!Number.isFinite(cardId)) return;
    const linkedCard = cardMap().get(cardId);
    if (!linkedCard) return;
    setLinkPreview({
      cardId,
      position: previewPosition,
    });
  };

  const createChildCardFromConnector = async (
    parentConnPoint: CardConnectorPoint,
    targetPoint: Dimmension
  ) => {
    const parentId = parentConnPoint.cardId;
    const childDir = oppositeDir(parentConnPoint.dir);
    const size = { x: 200, y: 200 };
    const childAbs = getCardPositionFromConnectorPoint(targetPoint, childDir, size);
    const parentAbs = getAbsPos(parentId);
    const draftCard = {
      id: 0,
      position: subtractPos(childAbs, parentAbs),
      size,
      title: "",
      contents: "",
      parent_id: parentId,
      visibility: cardMap().get(parentId)?.visibility ?? "public",
      tag_ids: [],
    };

    const created = await createCard(draftCard);
    const childCard: Card = {
      ...created,
      parent_id: parentId,
      position: created.position,
    };
    const childConnPoint: CardConnectorPoint = {
      cardId: created.id,
      dir: childDir,
    };
    const connector: CardConnector = {
      parent: parentConnPoint,
      child: childConnPoint,
      c: {
        parent: parentConnPoint,
        child: childConnPoint,
      },
    };

    await connectCards(parentId, created.id, connector);
    props.setCards((prev) => [...prev, childCard]);
    appendRelation({ parent_id: parentId, child_id: created.id, connector });

    const setter = posSetters.get(created.id);
    if (setter) setter(childAbs);
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
  // createEffect(
  //   on(nowTile, () => {
  // const [cx, cy] = nowTile().split(",").map(Number);
  // const needed = new Set<string>();
  // for (let dx = -1; dx <= 1; dx++) {
  //   for (let dy = -1; dy <= 1; dy++) {
  //     needed.add(`${cx + dx},${cy + dy}`);
  //   }
  // }
  // // 足りないタイルだけフェッチ
  // needed.forEach((key) => {
  //   if (!(key in tiles())) {
  //     const [tx, ty] = key.split(",").map(Number);
  //     const minX = tx * tileSize;
  //     const minY = ty * tileSize;
  //     const maxX = minX + tileSize;
  //     const maxY = minY + tileSize;
  //     fetch(
  //       `http://localhost:8082/cards/in_range?min_x=${minX}&min_y=${minY}&max_x=${maxX}&max_y=${maxY}`
  //     )
  //       .then((r) => r.json() as Promise<Card[]>)
  //       .then((res) => {
  //         const cards: number[] = [];
  //         res.data.forEach((card) => {
  //           if (props.cards().some((c) => c.id === card.id)) return;
  //           cards.push(card.id);
  //           props.setCards((prev) => [...prev, card]);
  //         });
  //         console.log(res);
  //         setTiles((prev) => ({ ...prev, [key]: cards }));
  //       })
  //       .catch(console.error);
  //   }
  // });
  //   })
  // );

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const zoomBounds = () => ({
    min: Math.pow(ZOOM.FACTOR, ZOOM.MIN),
    max: Math.pow(ZOOM.FACTOR, ZOOM.MAX),
  });

  const distance = (a: Dimmension, b: Dimmension) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const midpoint = (a: Dimmension, b: Dimmension): Dimmension => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const setScaleAroundScreenPoint = (nextScale: number, screenPoint: Dimmension) => {
    const { min, max } = zoomBounds();
    const clampedScale = clamp(nextScale, min, max);
    const worldPoint = {
      x: (screenPoint.x - position().x) / scale(),
      y: (screenPoint.y - position().y) / scale(),
    };
    const nextPosition = {
      x: Math.floor(screenPoint.x - worldPoint.x * clampedScale),
      y: Math.floor(screenPoint.y - worldPoint.y * clampedScale),
    };

    setScale(clampedScale);
    setZoomLevel(Math.log(clampedScale) / Math.log(ZOOM.FACTOR));
    setPosition(nextPosition);
    setMousePosition({
      x: screenPoint.x - nextPosition.x,
      y: screenPoint.y - nextPosition.y,
    });
  };

  const getTwoTouchPoints = () => {
    const points = Array.from(touchPointers.values());
    if (points.length < 2) return null;
    return [points[0], points[1]] as const;
  };

  const startPinch = () => {
    const points = getTwoTouchPoints();
    if (!points) return;
    pinchStart = {
      distance: distance(points[0], points[1]),
      scale: scale(),
      position: position(),
      center: midpoint(points[0], points[1]),
    };
    setIsPinching(true);
  };

  const updatePinch = () => {
    const points = getTwoTouchPoints();
    if (!points || !pinchStart || pinchStart.distance <= 0) return;

    const center = midpoint(points[0], points[1]);
    const nextDistance = distance(points[0], points[1]);
    const { min, max } = zoomBounds();
    const nextScale = clamp(
      pinchStart.scale * (nextDistance / pinchStart.distance),
      min,
      max
    );
    const worldCenter = {
      x: (pinchStart.center.x - pinchStart.position.x) / pinchStart.scale,
      y: (pinchStart.center.y - pinchStart.position.y) / pinchStart.scale,
    };
    const nextPosition = {
      x: Math.floor(center.x - worldCenter.x * nextScale),
      y: Math.floor(center.y - worldCenter.y * nextScale),
    };

    setScale(nextScale);
    setZoomLevel(Math.log(nextScale) / Math.log(ZOOM.FACTOR));
    setPosition(nextPosition);
    setMousePosition({
      x: center.x - nextPosition.x,
      y: center.y - nextPosition.y,
    });
  };

  const scrollPointers = () => inputManager.scrollPointers();

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    touchPointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    // Single touch: arm long-press (touch equivalent of right click)
    if (touchPointers.size === 1) {
      longPress.onDown(event);
    }
    // Multi-touch gesture: scroll / zoom the canvas
    if (touchPointers.size >= scrollPointers()) {
      longPress.cancel();
      event.preventDefault();
      startPinch();
    }
  };

  const handlePointerMove = (event: PointerEvent) => {
    setMousePosition({
      x: event.clientX - position().x,
      y: event.clientY - position().y,
    });
    if (event.pointerType !== "touch" || !touchPointers.has(event.pointerId)) return;
    touchPointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    longPress.onMove(event);
    if (isPinching()) {
      event.preventDefault();
      updatePinch();
    }
  };

  const handlePointerEnd = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    longPress.onEnd();
    touchPointers.delete(event.pointerId);
    if (touchPointers.size < scrollPointers()) {
      pinchStart = null;
      setIsPinching(false);
    } else {
      startPinch();
    }
  };

  onMount(() => {
    useDrag({
      ref,
      getPos: position,
      setPos: setPosition,
      scaleFactor: () => 1,
      // Allow the pan to start on any descendant (e.g. a card's non-text area),
      // not just the bare container background.
      strictTarget: false,
      startGuard: (e, el) =>
        touchPointers.size < scrollPointers() &&
        !isPinching() &&
        inputManager.canStartCanvasPan({ root: el, event: e }),
      continueGuard: () => !isPinching(),
    }); // Container のスクロールは zoomLevel の範疇外なので factor は 1
  });

  // Track external reveal requests and center once when card data is available
  createEffect(
    on(
      () => props.revealCardId?.(),
      (id) => setPendingRevealId(id ?? null)
    )
  );

  createEffect(() => {
    const id = pendingRevealId();
    if (!id) return;
    const card = cardMap().get(id);
    if (!card) return; // wait until cards are loaded
    const abs = getAbsPos(id);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const targetX = abs.x + card.size.x / 2;
    const targetY = abs.y + card.size.y / 2;
    setPosition({
      x: Math.floor(centerX - scale() * targetX),
      y: Math.floor(centerY - scale() * targetY),
    });
    // Clear so we don't re-center on unrelated state changes (like dragging)
    setPendingRevealId(null);
  });

  // Innermost frame card whose area contains the given absolute point (if any).
  const findContainingFrame = (
    p: Dimmension,
    excludeId?: Card["id"]
  ): Card | undefined => {
    const containing = props
      .cards()
      .filter((c) => c.card_type === "frame")
      .filter((c) => c.id !== excludeId)
      .filter((f) => {
        const a = getAbsPos(f.id);
        return (
          p.x >= a.x && p.x <= a.x + f.size.x && p.y >= a.y && p.y <= a.y + f.size.y
        );
      });
    // Prefer the smallest (innermost) frame when frames are nested.
    containing.sort((a, b) => a.size.x * a.size.y - b.size.x * b.size.y);
    return containing[0];
  };

  const addCard = (frameOverride?: Card) => {
    if (!props.canEdit()) return;

    const dropAbs = {
      x: fixedMousePosition().x,
      y: fixedMousePosition().y,
    };
    // If the card is dropped inside a frame (or created from a frame's menu),
    // it becomes that frame's child.
    const frame = frameOverride ?? findContainingFrame(dropAbs);
    const frameAbs = frame ? getAbsPos(frame.id) : ORIGIN;

    const newCard = {
      id: 0,
      position: frame ? subtractPos(dropAbs, frameAbs) : dropAbs,
      size: {
        x: 200,
        y: 200,
      },
      title: "",
      contents: "",
      visibility: frame?.visibility ?? "public",
      tag_ids: [],
    };
    console.log(newCard);
    createCard(newCard)
      .then((created) => {
        if (frame) {
          const childCard: Card = {
            ...created,
            parent_id: frame.id,
            position: created.position,
          };
          props.setCards((prev) => [...prev, childCard]);
          // Containment relation: establishes parent_id but draws no line.
          appendRelation({ parent_id: frame.id, child_id: created.id, connector: null });
          const setter = posSetters.get(created.id);
          if (setter) setter(dropAbs);
          attachChildToParent(frame.id, created.id).catch(console.error);
        } else {
          props.setCards((prev) => [...prev, created]);
          const setter = posSetters.get(created.id);
          if (setter) setter(created.position);
        }
      })
      .catch(console.error);
  };

  const handleScroll = (event: WheelEvent) => {
    const action = inputManager.resolveWheelAction({ when: "canvas", event });

    // Ctrl + wheel / trackpad pinch => zoom around the cursor (continuous).
    if (action === "view.zoom") {
      event.preventDefault();
      // Clamp per-event delta so a chunky mouse notch and a fine trackpad pinch
      // both feel reasonable, then map it to a multiplicative scale factor.
      const dy = Math.max(-25, Math.min(25, event.deltaY));
      const factor = Math.exp(-dy * 0.01);
      setScaleAroundScreenPoint(scale() * factor, {
        x: event.clientX,
        y: event.clientY,
      });
      return;
    }

    // Plain wheel / two-finger trackpad scroll => pan the canvas.
    if (action === "view.scroll") {
      event.preventDefault();
      const next = {
        x: Math.floor(position().x - event.deltaX),
        y: Math.floor(position().y - event.deltaY),
      };
      setPosition(next);
      setMousePosition({
        x: event.clientX - next.x,
        y: event.clientY - next.y,
      });
      return;
    }
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

  const getAbsPos = (id: number): Dimmension => getAbsPosFromMap(cardMap(), id);

  const replaceCard = (card: Card) => {
    props.setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
  };

  const appendRelation = (relation: CardRelation) => {
    props.setCardRelations((prev) =>
      prev.some(
        (r) =>
          r.parent_id === relation.parent_id &&
          r.child_id === relation.child_id
      )
        ? prev
        : [...prev, relation]
    );
  };

  const detachRelation = (parentId: Card["id"], childId: Card["id"]) => {
    props.setCardRelations((prev) =>
      prev.filter((r) => !(r.parent_id === parentId && r.child_id === childId))
    );
  };

  const removeCardAndRelations = (cardId: Card["id"], children: Card[]) => {
    props.setCards((prev) => {
      const removed = prev.filter((c) => c.id !== cardId);
      return removed.map((c) => children.find((p) => p.id === c.id) ?? c);
    });
    props.setCardRelations((prev) =>
      prev.filter((r) => r.parent_id !== cardId && r.child_id !== cardId)
    );
  };

  // Collect all descendant ids (children, grandchildren, ...)
  const getDescendants = (rootId: number): number[] => {
    const out: number[] = [];
    const stack: number[] = [rootId];
    const cards = props.cards();
    while (stack.length) {
      const cur = stack.pop()!;
      const children = cards.filter((c) => c.parent_id === cur).map((c) => c.id);
      for (const ch of children) {
        out.push(ch);
        stack.push(ch);
      }
    }
    return out;
  };

  const moveDescendants = (rootId: number, delta: Dimmension) => {
    if (!delta || (delta.x === 0 && delta.y === 0)) return;
    const targets = getDescendants(rootId);
    for (const id of targets) {
      const set = posSetters.get(id);
      if (!set) continue;
      set((prev) => ({ x: prev.x + delta.x, y: prev.y + delta.y }));
    }
  };

  const connectorPointToPos = (
    point: CardConnectorPoint
  ): Dimmension | undefined => {
    const card = cardMap().get(point.cardId);
    if (!card) return undefined;
    // Prefer live absolute position if available (reactive during drag)
    const live = posGetters.get(point.cardId)?.();
    const absBase = live ?? getAbsPos(point.cardId);
    const minimized = isMinimized(point.cardId);
    const hEff = minimized ? MINIMIZED_HEIGHT : card.size.y;
    const w = card.size.x;
    const abs: Dimmension = minimized
      ? { x: absBase.x, y: absBase.y + card.size.y / 2 - hEff / 2 }
      : absBase;
    switch (point.dir) {
      case "n":
        return { x: abs.x + w / 2, y: abs.y };
      case "s":
        return { x: abs.x + w / 2, y: abs.y + hEff };
      case "e":
        return { x: abs.x + w, y: abs.y + hEff / 2 };
      case "w":
        return { x: abs.x, y: abs.y + hEff / 2 };
    }
  };

  const nowCardConnectPath = (): Path | undefined => {
    const conn = connectStartedConnector();
    const near = nearestConnector();

    if (!conn) {
      console.error("connectStartedConnector is null");
      return;
    }

    const childCard = cardMap().get(conn.cardId);
    const parentCard = near ? cardMap().get(near.cardId) : undefined;

    if (!childCard) {
      console.error("Card not found");
      return;
    }

    const childPos = connectorPointToPos(conn);
    if (!childPos) return undefined;
    const fallbackTo = currentLine()?.to ?? fixedMousePosition();
    const parentPos = (() => {
      if (near && parentCard) {
        return connectorPointToPos(near) ?? fallbackTo;
      }
      return fallbackTo;
    })();

    return {
      child: childPos,
      parent: parentPos,
      c: {
        child: calcRelaxConnectorCtrls({ pos: childPos, dir: conn.dir }, 50),
        parent: near && parentCard
          ? calcRelaxConnectorCtrls({ pos: parentPos, dir: near.dir }, 50)
          : fallbackTo,
      },
    };
  };

  // Frames whose own top-left title has scrolled off-screen while the frame is
  // still (partly) visible. The sticky title is pinned to the nearest viewport
  // edge but keeps tracking the frame title's real X (when clipped at the top)
  // or Y (when clipped at the left), so it stays aligned with the frame.
  const STICKY_MARGIN = 8;
  const STICKY_OPEN_BUTTON_CLEARANCE_X = 64;
  const STICKY_OPEN_BUTTON_CLEARANCE_Y = 42;
  const stickyFrameTitles = createMemo(() => {
    const pos = position();
    const s = scale();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return props
      .cards()
      .filter((c) => c.card_type === "frame" && isCardVisible(c.id))
      .map((f) => {
        const a = getAbsPos(f.id);
        return {
          id: f.id,
          title: f.title || "(untitled)",
          visibility: f.visibility,
          screenX: pos.x + a.x * s,
          screenY: pos.y + a.y * s,
          w: f.size.x * s,
          h: f.size.y * s,
        };
      })
      // frame currently intersects the viewport ...
      .filter(
        (r) =>
          r.screenX < vw && r.screenX + r.w > 0 && r.screenY < vh && r.screenY + r.h > 0
      )
      // ... but its in-canvas title (top-left) is scrolled past the top/left edge
      .filter((r) => r.screenY < 0 || r.screenX < 0)
      .map((r) => ({
        id: r.id,
        title: r.title,
        visibility: r.visibility,
        // Clamp to the viewport: clipped-at-top -> pin to top (top=margin) but
        // keep the real X; clipped-at-left -> pin to left but keep the real Y.
        left: clamp(
          r.screenX,
          r.screenY < STICKY_OPEN_BUTTON_CLEARANCE_Y
            ? STICKY_OPEN_BUTTON_CLEARANCE_X
            : STICKY_MARGIN,
          vw - STICKY_MARGIN,
        ),
        top: clamp(r.screenY, STICKY_MARGIN, vh - STICKY_MARGIN),
      }));
  });

  return (
    <>
      <StyledCardContainer
        id="card-container"
        ref={ref}
        on:wheel={handleScroll}
        on:pointerdown={handlePointerDown}
        on:pointermove={handlePointerMove}
        on:pointerup={handlePointerEnd}
        on:pointercancel={handlePointerEnd}
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
          id="card-container-inner"
          ref={(el) => (containerRef = el!)}
          style={{
            position: "absolute",
            transform: `translate3d(${position().x}px, ${
              position().y
            }px, 0) scale(${scale()})`,
          }}
        >
          <For each={props.cards().filter((c) => isCardVisible(c.id))}>
            {(card) => {
              const id = card.id;
              const cardAcc = () => props.cards().find((c) => c.id === id)!;
              // Use absolute position for display, but convert to relative when saving
              const [position, setPosition] = createSignal<Dimmension>({ ...getAbsPos(id) });
              // Register for live lookup
              posGetters.set(id, position);
              posSetters.set(id, setPosition);
              return (
                <div
                  style={{
                    position: "absolute",
                    left: `${position().x}px`,
                    top: `${position().y + (isMinimized(id) ? cardAcc().size.y / 2 - MINIMIZED_HEIGHT / 2 : 0)}px`,
                  }}
                >
                  <CardElm
                    card={cardAcc}
                    mousePosition={mousePosition}
                    setNodePosition={setPosition}
                    nodePosition={position}
                    cardPosition={position}
                    isMinimized={() => isMinimized(id)}
                    onToggleMinimize={toggleMinimize}
                    onOpenPage={openPage}
                    onCreateCard={() => addCard(cardAcc())}
                    onCardLinkClick={openLinkedCardPreview}
                    showOkCountColor={showOkCountColor}
                    canEdit={props.canEdit}
                    setCard={(newCard) => {
                      const patched = withStoredPosFromAbs(
                        cardMap(),
                        newCard,
                        newCard.position,
                      );
                      replaceCard(patched);
                    }}
                    startConnect={(e, pos, cardId, dir) => {
                      startConnect(e, pos, cardId);
                      // Remember the child's starting connector point (the handle used)
                      setConnectStartedConnector({ cardId, dir });
                    }}
                    setEdittingCard={props.setEdittingCard}
                    scaleFactor={scale}
                    onHover={(card) => setHoveredCard(card)}
                    onLeave={() => {
                      setHoveredCard(null);
                      setNearestConnector(null);
                    }}
                    onNearestConnector={(p) => setNearestConnector(p)}
                    onMove={(diff) => {
                      // diff is delta from drag-start; convert to incremental
                      const prev = lastDragDelta.get(id) ?? { x: 0, y: 0 };
                      const inc = { x: diff.x - prev.x, y: diff.y - prev.y };
                      lastDragDelta.set(id, diff);
                      moveDescendants(id, inc);
                    }}
                    onUpdateCard={(updated) => {
                      // Clear tracking since drag ends
                      lastDragDelta.delete(id);
                      const dropCenter = {
                        x: updated.position.x + updated.size.x / 2,
                        y: updated.position.y + updated.size.y / 2,
                      };
                      const containingFrame =
                        updated.parent_id == null
                          ? findContainingFrame(dropCenter, updated.id)
                          : undefined;
                      if (containingFrame) {
                        const patched = withParentFromAbs(
                          cardMap(),
                          updated,
                          containingFrame.id,
                          updated.position,
                        );
                        replaceCard(patched);
                        appendRelation({
                          parent_id: containingFrame.id,
                          child_id: updated.id,
                          connector: null,
                        });
                        attachChildToParent(containingFrame.id, updated.id)
                          .then(() =>
                            updateCard(patched)
                          )
                          .catch(console.error);
                        return;
                      }
                      const patched = withStoredPosFromAbs(
                        cardMap(),
                        updated,
                        updated.position,
                      );
                      replaceCard(patched);
                      updateCard(patched);
                    }}
                    onDelete={async (deleteId) => {
                      // Capture card and relevant positions before mutating state
                      const doomed = cardAcc();
                      // Gather relations to remove in DB (both parent and child sides)
                      const rels = props
                        .cardRelations()
                        .filter((r) => r.parent_id === deleteId || r.child_id === deleteId);
                      // Detach direct children: set parent_id null and keep absolute position
                      const children = props.cards().filter((c) => c.parent_id === deleteId);
                      const patchedChildren = children.map((ch) => {
                        return withoutParentFromAbs(cardMap(), ch);
                      });
                      removeCardAndRelations(deleteId, patchedChildren);
                      // Clean live registries
                      posGetters.delete(deleteId);
                      posSetters.delete(deleteId);
                      lastDragDelta.delete(deleteId);
                      // Persist: disconnect all related edges first to satisfy FK, then delete card.
                      try {
                        await Promise.all(
                          rels.map((r) => disconnectCards(r.parent_id, r.child_id))
                        );
                        await Promise.all(patchedChildren.map((ch) => updateCard(ch)));
                        await deleteCardAPI(doomed);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    onDisconnectFromParent={async (childId) => {
                      const child = cardAcc();
                      if (child.parent_id == null) return;
                      const parentId = child.parent_id;
                      const patched = withoutParentFromAbs(cardMap(), child);
                      replaceCard(patched);
                      detachRelation(parentId, childId);
                      try {
                        await disconnectCards(parentId, childId);
                        // Once detached, the card becomes a root and must persist absolute position.
                        await updateCard(patched);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  />
                </div>
              );
            }}
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
              {(rel) => {
                const visible = () => isCardVisible(rel.parent_id) && isCardVisible(rel.child_id);
                if (!rel.connector) return null;
                const parentPos = () => connectorPointToPos(rel.connector!.parent);
                const childPos = () => connectorPointToPos(rel.connector!.child);
                return (
                  <Show when={visible() && parentPos() && childPos()}>
                    <PathElm
                      path={{
                        parent: parentPos()!,
                        child: childPos()!,
                        c: {
                          parent: calcRelaxConnectorCtrls({ pos: parentPos()!, dir: rel.connector.parent.dir }, 50),
                          child: calcRelaxConnectorCtrls({ pos: childPos()!, dir: rel.connector.child.dir }, 50),
                          points: rel.connector.c.points,
                        },
                      }}
                    />
                  </Show>
                );
              }}
            </For>
            <Show when={currentLine() !== null}>
              {nowCardConnectPath() && <PathElm path={nowCardConnectPath()!} />}
            </Show>
          </svg>
        </div>
        <Show when={linkPreview()}>
          {(preview) => {
            const previewCard = () => cardMap().get(preview().cardId);
            return (
              <Show when={previewCard()}>
                {(card) => (
                  <LinkedCardPreview
                    data-linked-card-preview
                    style={{
                      left: `${preview().position.x}px`,
                      top: `${preview().position.y}px`,
                    }}
                  >
                    <PreviewHeader>
                      <strong>
                        {extractFirstH1(card().contents || "") ||
                          card().title ||
                          `Card ${card().id}`}
                        <PrivateMark visible={isPrivateCard(card())} />
                      </strong>
                      <PreviewActions>
                        <Show when={props.canEdit()}>
                          <button onClick={() => props.setEdittingCard(card())}>編集</button>
                        </Show>
                        <button onClick={() => openPage(card().id)}>開く</button>
                        <button onClick={() => setLinkPreview(null)}>閉じる</button>
                      </PreviewActions>
                    </PreviewHeader>
                    <PreviewBody
                      class="markdown-body"
                      classList={{ "private-title-lock": isPrivateCard(card()) }}
                      onClick={(event) => handleLinkedMarkdownClick(card().id, event)}
                      markdown={() => card().contents || ""}
                    />
                  </LinkedCardPreview>
                )}
              </Show>
            );
          }}
        </Show>
      </StyledCardContainer>
      <Show when={pageViewId() != null}>
        <PageView
          card={() => props.cards().find((c) => c.id === pageViewId()!)}
          cards={props.cards}
          relations={props.cardRelations}
          onClose={() => closePage()}
          onNavigate={(id) => {
            setPageViewId(null);
            setLinkPreview({
              cardId: id,
              position: getPreviewScreenPosition(null, {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
              }),
            });
            try {
              window.history.pushState({ cardId: id }, "", `/card/${id}`);
            } catch {}
          }}
          onCardLinkClick={(event) => {
            const link = hrefFromCardLinkClick(event);
            if (!link) return;
            const sourceId = pageViewId();
            if (sourceId == null) return;
            event.preventDefault();
            event.stopPropagation();
            setPageViewId(null);
            openLinkedCardPreview(sourceId, link.href, {
              x: event.clientX,
              y: event.clientY,
            }, link.anchorRect);
          }}
        />
      </Show>
      {/* Sticky frame titles: pinned to the viewport edge while tracking the
          frame title's real X/Y for frames scrolled past their own title. */}
      <For each={stickyFrameTitles()}>
        {(t) => (
          <div
            style={{
              position: "fixed",
              left: `${t.left}px`,
              top: `${t.top}px`,
              "z-index": 1500,
              "pointer-events": "none",
              background: "rgba(30,30,30,0.85)",
              color: "#fff",
              padding: "4px 10px",
              "border-radius": "6px",
              "font-weight": 600,
              "font-size": "13px",
              "max-width": "40vw",
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
            }}
          >
            {t.title}
            <PrivateMark visible={t.visibility === "private"} />
          </div>
        )}
      </For>
      {/* Canvas indicators (bottom-right): block coord, fine coord, zoom slider */}
      <div
        style={{
          position: "fixed",
          right: "12px",
          bottom: "12px",
          "z-index": 1500,
          display: "flex",
          "flex-direction": "column",
          "align-items": "flex-end",
          gap: "4px",
          padding: "8px 10px",
          background: "rgba(255,255,255,0.85)",
          border: "1px solid #ddd",
          "border-radius": "6px",
          "font-size": "12px",
          color: "#333",
          "box-shadow": "0 2px 8px rgba(0,0,0,0.12)",
        }}
      >
        <div>{nowTile()}</div>
        <div>
          {position().x}, {position().y}
        </div>
        <label
          title="ok_count に応じた赤色を通常カードに表示"
          style={{
            display: "inline-flex",
            "align-items": "center",
            gap: "4px",
            "align-self": "flex-end",
            "user-select": "none",
            "-webkit-user-select": "none",
          }}
        >
          <input
            type="checkbox"
            checked={showOkCountColor()}
            onInput={(event) =>
              setShowOkCountColor(event.currentTarget.checked)
            }
            style={{ margin: 0 }}
          />
          色
        </label>
        <input
          type="range"
          min={ZOOM.MIN}
          max={ZOOM.MAX}
          step={1}
          value={zoomLevel()}
          onInput={(e) => {
            const level = Number(e.currentTarget.value);
            setScaleAroundScreenPoint(Math.pow(ZOOM.FACTOR, level), {
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
            });
          }}
        />
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

const LinkedCardPreview = styled("div", {
  base: {
    position: "fixed",
    zIndex: 1800,
    width: "320px",
    maxHeight: "360px",
    overflow: "hidden",
    background: "#fff",
    border: "1px solid #d6d6d6",
    borderRadius: "8px",
    boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
    padding: "10px 12px",
    pointerEvents: "auto",
  },
});

const PreviewHeader = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "8px",
    "& strong": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const PreviewActions = styled("div", {
  base: {
    display: "flex",
    gap: "4px",
    flexShrink: 0,
    "& button": {
      border: "1px solid #ddd",
      background: "#f7f7f7",
      borderRadius: "4px",
      padding: "2px 6px",
      cursor: "pointer",
      fontSize: "12px",
    },
  },
});

const PreviewBody = styled(MarkdownBody, {
  base: {
    maxHeight: "300px",
    overflow: "auto",
    fontSize: "13px",
    lineHeight: 1.55,
    "&.private-title-lock h1::after": {
      content: '"🔒"',
      fontSize: "0.72em",
      marginLeft: "0.28em",
      opacity: 0.72,
      verticalAlign: "0.08em",
    },
  },
});
