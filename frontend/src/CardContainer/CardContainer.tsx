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
import { connectCards, disconnectCards } from "../hooks/useConnectAPI.js";
import { CardRelation } from "../schema/CardRelation.js";
import { CardElm } from "../Card/Card.jsx";
import { getAbsPosFromMap } from "../utils/position.js";
import { PageView } from "../PageView/PageView.jsx";

export interface CardContainerProps {
  position: Dimmension;
  cards: Accessor<Card[]>;
  setCards: Setter<Card[]>;
  cardRelations: Accessor<CardRelation[]>;
  setCardRelations: Setter<CardRelation[]>;
  setEdittingCard: Setter<Card | null>;
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
  const [minimized, setMinimized] = createSignal<Set<number>>(new Set());
  const [pageViewId, setPageViewId] = createSignal<number | null>(null);

  // Compute a quick id->card map for lookups
  const cardMap = () => new Map(props.cards().map((c) => [c.id, c] as const));

  // Live absolute position registry for each card (for following + connectors)
  const posGetters = new Map<number, Accessor<Dimmension>>();
  const posSetters = new Map<number, Setter<Dimmension>>();
  const lastDragDelta = new Map<number, Dimmension>();

  // Minimize helpers
  const isCardVisible = (id: number) => {
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
    if (initial.kind === "page" && initial.id != null) props.onRequestReveal?.(initial.id);
    const handler = () => {
      const p = parsePath();
      if (p.kind === "view") {
        setPageViewId(p.id);
      } else if (p.kind === "page") {
        setPageViewId(null);
        if (p.id != null) props.onRequestReveal?.(p.id);
      } else {
        setPageViewId(null);
      }
    };
    window.addEventListener("popstate", handler);
    onCleanup(() => window.removeEventListener("popstate", handler));
  });

  const { currentLine, startConnect } = useConnector({
    mousePosition: fixedMousePosition,
    onUpCallback: async (fromID: Card["id"]) => {
      const parentConnPoint = nearestConnector();
      const childConnPoint = connectStartedConnector();
      console.log("onUpCallback", parentConnPoint);

      if (!parentConnPoint || !childConnPoint) return;

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
        props.setCardRelations((prev) => [
          ...prev,
          {
            parent_id: parentId,
            child_id: childId,
            connector,
          },
        ]);

        const parentAbs = getAbsPos(parentId);
        const childAbs = getAbsPos(childId);
        const newChildCard: Card = {
          ...childCard,
          parent_id: parentId,
          position: {
            x: childAbs.x - parentAbs.x,
            y: childAbs.y - parentAbs.y,
          },
        };
        props.setCards((prev) =>
          prev.map((c) => (c.id === childId ? newChildCard : c))
        );
        // Keep DB's absolute shape unchanged on relation change
        updateCard({ ...childCard, position: childAbs });
        // Clear temp connector states
        setConnectStartedConnector(null);
        setNearestConnector(null);
      });
    },
  });

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

  // Center view on a given card id (when provided)
  // Reacts also when cards are loaded later so initial deep link works.
  createEffect(() => {
    const id = props.revealCardId?.();
    if (!id) return;
    const card = cardMap().get(id);
    if (!card) return;
    const abs = getAbsPos(id);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const targetX = abs.x + card.size.x / 2;
    const targetY = abs.y + card.size.y / 2;
    setPosition({
      x: Math.floor(centerX - scale() * targetX),
      y: Math.floor(centerY - scale() * targetY),
    });
  });

  const addCard = () => {
    const newCard = {
      id: 0,
      position: {
        x: fixedMousePosition().x,
        y: fixedMousePosition().y,
      },
      size: {
        x: 200,
        y: 200,
      },
      title: "",
      contents: "",
      tag_ids: [],
    };
    console.log(newCard);
    createCard(newCard)
      .then((created) => {
        // Append created card immediately
        props.setCards((prev) => [...prev, created]);
        // Register live position for connectors immediately
        // If maps exist, seed with absolute position
        const abs = created.position; // parent_id is null => absolute
        const setter = posSetters.get(created.id);
        if (setter) setter(abs);
      })
      .catch(console.error);
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

  const getAbsPos = (id: number): Dimmension => getAbsPosFromMap(cardMap(), id);

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

  return (
    <>
      <StyledCardContainer
        id="card-container"
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
              const parentAbs = () => (cardAcc().parent_id ? getAbsPos(cardAcc().parent_id!) : { x: 0, y: 0 });
              const cardPosition = () => ({ x: position().x - parentAbs().x, y: position().y - parentAbs().y });

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
                    cardPosition={cardPosition}
                    isMinimized={() => isMinimized(id)}
                    onToggleMinimize={toggleMinimize}
                    onOpenPage={openPage}
                    setCard={(newCard) => {
                      // Ensure stored position remains relative to parent
                      const parentAbs = newCard.parent_id ? getAbsPos(newCard.parent_id) : { x: 0, y: 0 };
                      const relative = {
                        x: newCard.position.x - parentAbs.x,
                        y: newCard.position.y - parentAbs.y,
                      };
                      const patched = { ...newCard, position: relative };
                      props.setCards((prev) => prev.map((c) => (c.id === id ? patched : c)));
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
                      // Convert absolute drop position to relative for in-memory state
                      const parentAbs = updated.parent_id ? getAbsPos(updated.parent_id) : { x: 0, y: 0 };
                      const relative = {
                        x: updated.position.x - parentAbs.x,
                        y: updated.position.y - parentAbs.y,
                      };
                      const patched = { ...updated, position: relative };
                      props.setCards((prev) => prev.map((c) => (c.id === id ? patched : c)));
                      // Persist absolute to DB to keep shape correct
                      updateCard({ ...updated, position: { ...updated.position } });
                    }}
                    onDelete={async (deleteId) => {
                      // Capture card and relevant positions before mutating state
                      const doomed = cardAcc();
                      const doomedAbs = getAbsPos(deleteId);
                      // Gather relations to remove in DB (both parent and child sides)
                      const rels = props
                        .cardRelations()
                        .filter((r) => r.parent_id === deleteId || r.child_id === deleteId);
                      // Detach direct children: set parent_id null and keep absolute position
                      const children = props.cards().filter((c) => c.parent_id === deleteId);
                      const patchedChildren = children.map((ch) => {
                        const abs = getAbsPos(ch.id);
                        return { ...ch, parent_id: undefined, position: abs } as Card;
                      });
                      // Update state: remove card, patch children, remove relations
                      props.setCards((prev) => {
                        const removed = prev.filter((c) => c.id !== deleteId);
                        // Apply children patches
                        return removed.map((c) => {
                          const patched = patchedChildren.find((p) => p.id === c.id);
                          return patched ? patched : c;
                        });
                      });
                      props.setCardRelations((prev) =>
                        prev.filter((r) => r.parent_id !== deleteId && r.child_id !== deleteId)
                      );
                      // Clean live registries
                      posGetters.delete(deleteId);
                      posSetters.delete(deleteId);
                      lastDragDelta.delete(deleteId);
                      // Persist: disconnect all related edges first to satisfy FK, then delete card.
                      try {
                        await Promise.all(
                          rels.map((r) => disconnectCards(r.parent_id, r.child_id))
                        );
                        await deleteCardAPI(doomed);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    onDisconnectFromParent={async (childId) => {
                      const child = cardAcc();
                      if (child.parent_id == null) return;
                      const parentId = child.parent_id;
                      // Compute absolute to preserve on screen
                      const abs = getAbsPos(childId);
                      const patched: Card = { ...child, parent_id: undefined, position: abs };
                      props.setCards((prev) => prev.map((c) => (c.id === childId ? patched : c)));
                      props.setCardRelations((prev) =>
                        prev.filter((r) => !(r.parent_id === parentId && r.child_id === childId))
                      );
                      try {
                        await disconnectCards(parentId, childId);
                        // DB shape should already be absolute; keep it by updating with abs
                        await updateCard({ ...child, position: abs });
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
      </StyledCardContainer>
      <Show when={pageViewId() != null}>
        <PageView
          card={() => props.cards().find((c) => c.id === pageViewId()!)}
          cards={props.cards}
          relations={props.cardRelations}
          onClose={() => closePage()}
          onNavigate={(id) => openPage(id)}
        />
      </Show>
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
        <p>
          {fixedMousePosition().x},{fixedMousePosition().y}
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
