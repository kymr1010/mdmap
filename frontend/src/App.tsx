import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
// import init from "@memo-app/wasm";
import { CardContainer } from "./CardContainer/CardContainer.jsx";
import { globalStyle } from "@macaron-css/core";
import { EditorPanel } from "./EditorPanel/EditorPanel.jsx";
import { Card, Dir } from "./schema/Card.js";
import { getCards, updateCard } from "./hooks/useCardAPI.js";
import {
  normalizeCardsToRelative,
  buildCardMap,
  getAbsPosFromMap,
} from "./utils/position.js";
import {
  attachChildToParent,
  connectCards,
  disconnectCards,
  getCardRelations,
  updateCardConnector,
} from "./hooks/useConnectAPI.js";
import { CardRelation } from "./schema/CardRelation.js";
import { CardConnector } from "./schema/Connrctor.js";
import { Dimmension } from "./schema/Point.js";
// import { DataCheck } from "./DataCheck/DataCheck.jsx";
import SideCardTree from "./SideCardTree/SideCardTree.jsx";
import { getAuthStatus, login, logout } from "./hooks/useAuthAPI.js";

const LOGIN_QUERY_KEY = import.meta.env.VITE_LOGIN_QUERY_KEY ?? "";
const LOGIN_QUERY_VALUE = import.meta.env.VITE_LOGIN_QUERY_VALUE ?? "";

globalStyle("body", {
  "--color-bg": "#fff",
  "--color-bg-border": "#eee",
});

// globalStyle("body", {
//   "--color-bg": "#111",
//   "--color-bg-border": "#0f0",
// });

globalStyle("body", {
  fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
          Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji" !important;`,
});
globalStyle("pre, code", {
  fontFamily: `ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas,
          Liberation Mono, monospace !important;`,
});

function App() {
  const [edittingCard, setEdittingCard] = createSignal<Card | null>(null);
  const [cards, setCards] = createSignal<Card[]>([]);
  const [cardRelations, setCardRelations] = createSignal<CardRelation[]>([]);
  const [revealCardId, setRevealCardId] = createSignal<number | null>(null);
  const [canvasMousePosition, setCanvasMousePosition] = createSignal<Dimmension>({
    x: 0,
    y: 0,
  });
  const [canEdit, setCanEdit] = createSignal(false);
  const [authEnabled, setAuthEnabled] = createSignal(true);
  const [password, setPassword] = createSignal("");
  const [authError, setAuthError] = createSignal("");
  const [showLoginControls, setShowLoginControls] = createSignal(false);
  const sidebarWidth = 280;
  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  const connectorPoint = (card: Card, abs: Dimmension, dir: Dir): Dimmension => {
    switch (dir) {
      case "n":
        return { x: abs.x + card.size.x / 2, y: abs.y };
      case "s":
        return { x: abs.x + card.size.x / 2, y: abs.y + card.size.y };
      case "e":
        return { x: abs.x + card.size.x, y: abs.y + card.size.y / 2 };
      case "w":
        return { x: abs.x, y: abs.y + card.size.y / 2 };
    }
  };

  const nearestConnector = (
    parent: Card,
    parentAbs: Dimmension,
    child: Card,
    childAbs: Dimmension,
  ): CardConnector => {
    const dirs: Dir[] = ["n", "s", "e", "w"];
    let best = {
      parentDir: "n" as Dir,
      childDir: "s" as Dir,
      distance: Number.POSITIVE_INFINITY,
    };

    for (const parentDir of dirs) {
      const parentPoint = connectorPoint(parent, parentAbs, parentDir);
      for (const childDir of dirs) {
        const childPoint = connectorPoint(child, childAbs, childDir);
        const d = Math.hypot(parentPoint.x - childPoint.x, parentPoint.y - childPoint.y);
        if (d < best.distance) best = { parentDir, childDir, distance: d };
      }
    }

    const parentPoint = { cardId: parent.id, dir: best.parentDir };
    const childPoint = { cardId: child.id, dir: best.childDir };
    return {
      parent: parentPoint,
      child: childPoint,
      c: {
        parent: parentPoint,
        child: childPoint,
      },
    };
  };

  const persistConnector = async (
    relation: CardRelation,
    connector: CardConnector | null,
  ) => {
    try {
      await updateCardConnector(relation.parent_id, relation.child_id, connector);
    } catch (e) {
      console.error(e);
      await disconnectCards(relation.parent_id, relation.child_id);
      if (connector) {
        await connectCards(relation.parent_id, relation.child_id, connector);
      } else {
        await attachChildToParent(relation.parent_id, relation.child_id);
      }
    }
  };

  const handleFrameTypeConversion = async (
    card: Card,
    previousCard?: Card,
  ): Promise<boolean> => {
    const previousType = previousCard?.card_type ?? "normal";
    const nextType = card.card_type ?? "normal";
    if (previousType === nextType) return false;

    const directRelations = cardRelations().filter((r) => r.parent_id === card.id);
    const map = buildCardMap(cards());

    if (nextType === "frame") {
      const abs = getAbsPosFromMap(map, card.id);
      await updateCard({ ...card, position: abs });
      setCardRelations((prev) =>
        prev.map((r) => (r.parent_id === card.id ? { ...r, connector: null } : r)),
      );
      await Promise.all(directRelations.map((r) => persistConnector(r, null)));
      return true;
    }

    if (previousType === "frame" && nextType === "normal") {
      const childAbsById = new Map(
        directRelations.map((r) => [r.child_id, getAbsPosFromMap(map, r.child_id)] as const),
      );
      const newParentAbs = { ...canvasMousePosition() };
      const parentOfParentAbs =
        card.parent_id != null ? getAbsPosFromMap(map, card.parent_id) : { x: 0, y: 0 };
      const movedParent: Card = {
        ...card,
        position: {
          x: newParentAbs.x - parentOfParentAbs.x,
          y: newParentAbs.y - parentOfParentAbs.y,
        },
      };
      const connectors = new Map<Card["id"], CardConnector>();

      for (const relation of directRelations) {
        const child = map.get(relation.child_id);
        const childAbs = childAbsById.get(relation.child_id);
        if (!child || !childAbs) continue;
        connectors.set(
          relation.child_id,
          nearestConnector(movedParent, newParentAbs, child, childAbs),
        );
      }

      setCards((prev) =>
        prev.map((c) => {
          if (c.id === card.id) return movedParent;
          const childAbs = childAbsById.get(c.id);
          if (!childAbs) return c;
          return {
            ...c,
            position: {
              x: childAbs.x - newParentAbs.x,
              y: childAbs.y - newParentAbs.y,
            },
          };
        }),
      );
      setCardRelations((prev) =>
        prev.map((r) =>
          r.parent_id === card.id
            ? { ...r, connector: connectors.get(r.child_id) ?? r.connector }
            : r,
        ),
      );

      await updateCard({ ...movedParent, position: newParentAbs });
      await Promise.all(
        directRelations.map((r) => {
          const connector = connectors.get(r.child_id);
          return connector ? persistConnector(r, connector) : Promise.resolve();
        }),
      );
      return true;
    }

    return false;
  };

  // Viewers (not authenticated) only see public cards. Admins see everything.
  const displayCards = createMemo(() =>
    canEdit() ? cards() : cards().filter((c) => c.visibility !== "private"),
  );

  // NodeTree removed for simplicity; render from cards directly

  onMount(async () => {
    const syncLoginControls = () => {
      const params = new URLSearchParams(window.location.search);
      setShowLoginControls(
        LOGIN_QUERY_KEY.length > 0 &&
          LOGIN_QUERY_VALUE.length > 0 &&
          params.get(LOGIN_QUERY_KEY) === LOGIN_QUERY_VALUE,
      );
    };

    syncLoginControls();
    window.addEventListener("popstate", syncLoginControls);
    onCleanup(() => window.removeEventListener("popstate", syncLoginControls));

    getAuthStatus()
      .then((status) => {
        setCanEdit(status.authenticated);
        setAuthEnabled(status.auth_enabled);
      })
      .catch((e) => {
        console.error("failed to load auth status", e);
        setCanEdit(false);
      });

    const rels = await getCardRelations();
    const fetched = await getCards();
    setCardRelations(rels);
    setCards(normalizeCardsToRelative(fetched));
    console.log(cardRelations());
    // init();
  });

  const handleLogin = async (event: Event) => {
    event.preventDefault();
    setAuthError("");

    try {
      const status = await login(password());
      setCanEdit(status.authenticated);
      setAuthEnabled(status.auth_enabled);
      setPassword("");
    } catch (e) {
      console.error(e);
      setAuthError("ログインできませんでした");
      setCanEdit(false);
    }
  };

  const handleLogout = async () => {
    setAuthError("");

    try {
      const status = await logout();
      setCanEdit(status.authenticated);
      setAuthEnabled(status.auth_enabled);
      setEdittingCard(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <SideCardTree
        cards={displayCards}
        canEdit={canEdit}
        authEnabled={authEnabled}
        showLoginControls={showLoginControls}
        password={password}
        setPassword={setPassword}
        authError={authError}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onReveal={(id) => {
          setRevealCardId(id);
          try {
            window.history.pushState({ cardId: id }, "", `/card/${id}`);
          } catch {}
          // Notify listeners (CardContainer) to sync overlay state
          try {
            window.dispatchEvent(new PopStateEvent("popstate"));
          } catch {}
        }}
        width={sidebarWidth}
        open={sidebarOpen()}
        onClose={() => setSidebarOpen(false)}
        onOpen={() => setSidebarOpen(true)}
      />
      <CardContainer
        position={{ x: 0, y: 0 }}
        cards={displayCards}
        setCards={setCards}
        cardRelations={cardRelations}
        setCardRelations={setCardRelations}
        setEdittingCard={setEdittingCard}
        canEdit={canEdit}
        revealCardId={revealCardId}
        onRequestReveal={(id) => setRevealCardId(id)}
        onMouseWorldPositionChange={setCanvasMousePosition}
      />
      <Show when={canEdit()}>
        <EditorPanel
          card={edittingCard}
          setCard={(card) => {
            setEdittingCard(card);
            setCards((prev) => {
              return prev.map((c) => {
                if (c.id === card.id) return card;
                return c;
              });
            });
          }}
          onSave={async (card, previousCard) => {
            // Persist edits to DB using absolute position
            const handledConversion = await handleFrameTypeConversion(card, previousCard);
            if (!handledConversion) {
              const abs = getAbsPosFromMap(buildCardMap(cards()), card.id);
              await updateCard({ ...card, position: abs });
            }
            setEdittingCard(null);
          }}
          onCancel={() => setEdittingCard(null)}
        />
      </Show>
      {/* <Tree nodes={nodeTree} /> */}
    </div>
  );
}

export default App;
