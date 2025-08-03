import { createSignal, For, onMount } from "solid-js";
// import init from "@memo-app/wasm";
import { CardContainer } from "./CardContainer/CardContainer.jsx";
import { globalStyle } from "@macaron-css/core";
import { EditorPanel } from "./EditorPanel/EditorPanel.jsx";
import { Card } from "./schema/Card.js";
import { getCards, updateCard } from "./hooks/useCardAPI.js";
import { getCardRelations } from "./hooks/useConnectAPI.js";
import { CardRelation } from "./schema/CardRelation.js";
import { useNodeTree } from "./hooks/useCardTree.js";
import { DataCheck } from "./DataCheck/DataCheck.jsx";
import { Tree } from "./Tree/Tree.jsx";

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

  const { nodeTree, nodeMap } = useNodeTree(
    cards,
    setCards,
    cardRelations,
    setCardRelations
  );

  onMount(async () => {
    const res = await fetch("http://localhost:8082/");
    const text = await res.text();
    const rels = await getCardRelations();
    const cards = await getCards();
    setCardRelations(rels);
    setCards(cards);
    console.log(cardRelations());
    console.log(text); // "Hello, World! 🎉"
    // init();
  });

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
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

      <For each={nodeTree()}>
        {(node) => <DataCheck data={node} index={node.card().id}></DataCheck>}
      </For>
      <CardContainer
        position={{ x: 0, y: 0 }}
        nodeTree={nodeTree}
        nodeMap={nodeMap}
        setEdittingCard={setEdittingCard}
      />
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
          if (!card) updateCard(card);
          setEdittingCard(null);
        }}
        onCancel={() => setEdittingCard(null)}
      />
      <Tree nodes={nodeTree} />
    </div>
  );
}

export default App;
