import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
// import init from "@memo-app/wasm";
import { CardContainer } from "./CardContainer/CardContainer.jsx";
import { globalStyle } from "@macaron-css/core";
import { EditorPanel } from "./EditorPanel/EditorPanel.jsx";
import { Card } from "./schema/Card.js";
import { getCards, updateCard } from "./hooks/useCardAPI.js";
import {
  normalizeCardsToRelative,
  getAbsPos,
  buildCardMap,
  getAbsPosFromMap,
} from "./utils/position.js";
import { getCardRelations } from "./hooks/useConnectAPI.js";
import { CardRelation } from "./schema/CardRelation.js";
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
  const [canEdit, setCanEdit] = createSignal(false);
  const [authEnabled, setAuthEnabled] = createSignal(true);
  const [password, setPassword] = createSignal("");
  const [authError, setAuthError] = createSignal("");
  const [showLoginControls, setShowLoginControls] = createSignal(false);
  const sidebarWidth = 280;
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const effectiveSidebarWidth = () => (sidebarOpen() ? sidebarWidth : 0);

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
          onSave={(card) => {
            // Persist edits to DB using absolute position
            const abs = getAbsPosFromMap(buildCardMap(cards()), card.id);
            updateCard({ ...card, position: abs });
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
