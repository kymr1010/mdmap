import { styled } from "@macaron-css/solid";
import { Accessor, For, Show, createMemo, createSignal } from "solid-js";
import { Card } from "../schema/Card.js";

type SideCardTreeProps = {
  cards: Accessor<Card[]>;
  onReveal: (cardId: number) => void;
  width?: number; // px
  open?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  // Auth controls (rendered inside the sidebar)
  canEdit?: Accessor<boolean>;
  authEnabled?: Accessor<boolean>;
  showLoginControls?: Accessor<boolean>;
  password?: Accessor<string>;
  setPassword?: (value: string) => void;
  authError?: Accessor<string>;
  apiToken?: Accessor<string>;
  apiTokenError?: Accessor<string>;
  onLogin?: (event: Event) => void;
  onLogout?: () => void;
  onGenerateApiToken?: () => void;
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
    <>
      <Wrapper style={{ width: `${props.open ? width() : 0}px` }}>
        <Sidebar style={{ width: `${width()}px` }}>
          <Header>
            <span>Cards</span>
            <CloseBtn onClick={() => props.onClose?.()} title="Close sidebar">{"<<<"}</CloseBtn>
          </Header>
          <ScrollArea>
            <TreeList items={tree()} level={0} onReveal={(id) => { setSelectedId(id); props.onReveal(id); }} selectedId={selectedId} />
          </ScrollArea>
          {/* Only admins, or visitors who arrived with the secret login query,
              ever see this section. Plain viewers get no hint that an edit mode
              exists at all. */}
          <Show when={props.canEdit?.() || (props.authEnabled?.() && props.showLoginControls?.())}>
            <AuthSection>
              <Show
                when={props.canEdit?.()}
                fallback={
                  <form
                    onSubmit={(e) => props.onLogin?.(e)}
                    style={{ display: "flex", "flex-direction": "column", gap: "6px" }}
                  >
                    <input
                      type="password"
                      value={props.password?.() ?? ""}
                      onInput={(e) => props.setPassword?.(e.currentTarget.value)}
                      placeholder="編集パスワード"
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        border: "1px solid #3a3a3a",
                        "border-radius": "4px",
                        background: "#2a2a2a",
                        color: "#eee",
                        "box-sizing": "border-box",
                      }}
                    />
                    <button type="submit">ログイン</button>
                    <Show when={props.authError?.()}>
                      <span style={{ color: "#ff6b6b", "font-size": "12px" }}>
                        {props.authError?.()}
                      </span>
                    </Show>
                  </form>
                }
              >
                <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
                  <StatusRow>
                    <StatusText>編集モード</StatusText>
                    <button onClick={() => props.onLogout?.()}>ログアウト</button>
                  </StatusRow>
                  <button onClick={() => props.onGenerateApiToken?.()}>
                    APIトークン発行
                  </button>
                  <Show when={props.apiToken?.()}>
                    <TokenBox>
                      <TokenLabel>発行されたAPIトークン</TokenLabel>
                      <textarea readOnly value={props.apiToken?.() ?? ""} />
                    </TokenBox>
                  </Show>
                  <Show when={props.apiTokenError?.()}>
                    <span style={{ color: "#ff6b6b", "font-size": "12px" }}>
                      {props.apiTokenError?.()}
                    </span>
                  </Show>
                </div>
              </Show>
            </AuthSection>
          </Show>
        </Sidebar>
      </Wrapper>
      <Show when={!props.open}>
        <OpenBtn
          onClick={() => props.onOpen?.()}
          title="Show sidebar"
        >
          {">>>"}
        </OpenBtn>
      </Show>
    </>
  );
};

const TreeList = (props: {
  items: TreeItem[];
  level: number;
  onReveal: (id: number) => void;
  selectedId: Accessor<number | null>;
}) => {
  return (
    <ul style={{ listStyle: "none", margin: 0, paddingLeft: `0px` }}>
      <For each={props.items}>
        {(item) => (
          <li>
            <NodeRow item={item} level={props.level} onReveal={props.onReveal} selectedId={props.selectedId} />
          </li>
        )}
      </For>
    </ul>
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
  const indent = () => props.level * 16; // px per depth

  return (
    <div>
      <Row style={{ paddingLeft: `0px` }} data-selected={props.selectedId() === props.item.id ? "true" : "false"}>
        <span style={{ width: `${indent()}px`, display: "inline-block", flex: "0 0 auto" }} />
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
        <TreeList items={props.item.children} level={props.level + 1} onReveal={props.onReveal} selectedId={props.selectedId} />
      </Show>
    </div>
  );
};

const Wrapper = styled("div", {
  base: {
    overflow: "hidden",
    transition: "width 0.25s ease",
    position: "fixed",
    top: 0,
    left: 0,
    height: "100vh",
    zIndex: 7000,
  },
});

const Sidebar = styled("aside", {
  base: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: "#1e1e1e",
    color: "#ddd",
    borderRight: "1px solid #2a2a2a",
    userSelect: "none",
    position: "relative",
    zIndex: 7001,
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
    position: "relative",
  },
});

const ScrollArea = styled("div", {
  base: {
    overflow: "auto",
    flex: 1,
  },
});

const AuthSection = styled("div", {
  base: {
    padding: "10px",
    borderTop: "1px solid #2a2a2a",
    fontSize: "13px",
  },
});

const StatusRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
});

const StatusText = styled("span", {
  base: {
    fontSize: "12px",
    color: "#9aa0a6",
  },
});

const TokenBox = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    "& textarea": {
      width: "100%",
      minHeight: "68px",
      boxSizing: "border-box",
      padding: "6px",
      border: "1px solid #3a3a3a",
      borderRadius: "4px",
      background: "#151515",
      color: "#eee",
      fontFamily: "monospace",
      fontSize: "12px",
      resize: "vertical",
    },
  },
});

const TokenLabel = styled("span", {
  base: {
    fontSize: "12px",
    color: "#9aa0a6",
  },
});

const Row = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    height: "24px",
    fontSize: "13px",
    cursor: "pointer",
    width: "100%",
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

const CloseBtn = styled("button", {
  base: {
    position: "absolute",
    right: "8px",
    top: "6px",
    border: "1px solid #3a3a3a",
    background: "#2a2a2a",
    color: "#ccc",
    borderRadius: "4px",
    padding: "2px 6px",
    cursor: "pointer",
  },
});

const OpenBtn = styled("button", {
  base: {
    position: "fixed",
    top: "10px",
    left: "10px",
    zIndex: 99999,
    border: "1px solid #ccc",
    background: "#fff",
    color: "#333",
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
    borderRadius: "4px",
    padding: "4px 8px",
    cursor: "pointer",
  },
});
