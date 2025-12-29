import { styled } from "@macaron-css/solid";
import { Accessor, For, Show, createMemo, createSignal } from "solid-js";
import { Card } from "../schema/Card.js";

type SideCardTreeProps = {
  cards: Accessor<Card[]>;
  onReveal: (cardId: number) => void;
  width?: number; // px
};

type TreeItem = Card & { children: TreeItem[] };

const buildTree = (cards: Card[]): TreeItem[] => {
  const byId = new Map<number, TreeItem>();
  const roots: TreeItem[] = [];
  for (const c of cards) byId.set(c.id, { ...c, children: [] });
  for (const c of cards) {
    const item = byId.get(c.id)!;
    if (c.parent_id != null && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.children.push(item);
    } else {
      roots.push(item);
    }
  }
  return roots;
};

export const SideCardTree = (props: SideCardTreeProps) => {
  const width = () => props.width ?? 280;
  const tree = createMemo(() => buildTree(props.cards()));
  const [selectedId, setSelectedId] = createSignal<number | null>(null);

  return (
    <Sidebar style={{ width: `${width()}px` }}>
      <Header>
        <span>Cards</span>
      </Header>
      <ScrollArea>
        <For each={tree()}>{(node) => <NodeRow item={node} level={0} onReveal={(id) => { setSelectedId(id); props.onReveal(id); }} selectedId={selectedId} />}</For>
      </ScrollArea>
    </Sidebar>
  );
};

const NodeRow = (props: {
  item: TreeItem;
  level: number;
  onReveal: (id: number) => void;
  selectedId: Accessor<number | null>;
}) => {
  const [open, setOpen] = createSignal(true);
  const isFolder = () => props.item.children.length > 0;
  const padding = () => 8 + props.level * 12;

  return (
    <div style={{ borderLeft: "1px solid #fff" }}>
      <Row style={{ paddingLeft: `${padding()}px` }} data-selected={props.selectedId() === props.item.id ? "true" : "false"}>
        <Caret onClick={(e) => { e.stopPropagation(); if (isFolder()) setOpen(!open()); }}>
          <Show when={isFolder()} fallback={<span style={{ width: "12px", display: "inline-block" }} />}>{open() ? "▼" : "▶"}</Show>
        </Caret>
        <Label
          onClick={() => props.onReveal(props.item.id)}
          title={props.item.title || `Card ${props.item.id}`}
        >
          <Show when={isFolder()} fallback={<span>📄</span>}>
            <span>📁</span>
          </Show>
          <span style={{ marginLeft: "0.5em" }}>{props.item.title || "(untitled)"}</span>
        </Label>
      </Row>
      <Show when={open() && isFolder()}>
        <For each={props.item.children}>
          {(ch) => (
            <NodeRow item={ch} level={props.level + 1} onReveal={props.onReveal} selectedId={props.selectedId} />
          )}
        </For>
      </Show>
    </div>
  );
};

const Sidebar = styled("aside", {
  base: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: "#1e1e1e",
    color: "#ddd",
    borderRight: "1px solid #2a2a2a",
    userSelect: "none",
    zIndex: 1500,
  },
});

const Header = styled("div", {
  base: {
    padding: "8px 10px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#9aa0a6",
    borderBottom: "1px solid #2a2a2a",
  },
});

const ScrollArea = styled("div", {
  base: {
    overflow: "auto",
    flex: 1,
  },
});

const Row = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    height: "24px",
    fontSize: "13px",
    cursor: "pointer",
    selectors: {
      '&[data-selected="true"]': {
        backgroundColor: "#2a2d2e",
      },
      "&:hover": {
        backgroundColor: "#2a2d2e",
      },
    },
  },
});

const Caret = styled("span", {
  base: {
    display: "inline-flex",
    width: "16px",
    justifyContent: "center",
    color: "#9aa0a6",
  },
});

const Label = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    padding: "0 6px 0 2px",
    flex: 1,
  },
});

export default SideCardTree;

