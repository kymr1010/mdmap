import { styled } from "@macaron-css/solid";
import { Accessor, For, Show, createMemo } from "solid-js";
import type { Card } from "../schema/Card.js";
import type { CardRelation } from "../schema/CardRelation.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { extractFirstH1 } from "../utils/markdown.js";

type PageViewProps = {
  card: Accessor<Card | undefined>;
  cards: Accessor<Card[]>;
  relations: Accessor<CardRelation[]>;
  onClose: () => void;
  onNavigate?: (id: number) => void;
};

export const PageView = (props: PageViewProps) => {
  const title = () => extractFirstH1(props.card()?.contents ?? "") || props.card()?.title || "(untitled)";
  const id = () => props.card()?.id;
  const byId = createMemo(() => new Map(props.cards().map((c) => [c.id, c] as const)));
  const parents = createMemo(() => props.relations().filter((r) => r.child_id === id()).map((r) => byId().get(r.parent_id)).filter(Boolean) as Card[]);
  const children = createMemo(() => props.relations().filter((r) => r.parent_id === id()).map((r) => byId().get(r.child_id)).filter(Boolean) as Card[]);
  const cardTitle = (c: Card) => extractFirstH1(c.contents || "") || c.title || `Card ${c.id}`;
  return (
    <Overlay>
      <PageContainer>
        <Header>
          <CloseBtn onClick={props.onClose} aria-label="Close">×</CloseBtn>
        </Header>
        <Content class="markdown-body" innerHTML={DOMPurify.sanitize(marked(props.card()?.contents || ""))} />
        <Lists>
          <Show when={parents().length > 0}>
            <Section>
              <h3 style={{ margin: "16px 0 8px" }}>Parent</h3>
              <ul style={{ margin: 0, paddingLeft: "16px" }}>
                <For each={parents()}>
                  {(p) => (
                    <li>
                      <a href={`/card/${p.id}/view`} onClick={(e) => { e.preventDefault(); props.onNavigate?.(p.id); }}>
                        {cardTitle(p)}
                      </a>
                    </li>
                  )}
                </For>
              </ul>
            </Section>
          </Show>
          <Show when={children().length > 0}>
            <Section>
              <h3 style={{ margin: "16px 0 8px" }}>Children</h3>
              <ul style={{ margin: 0, paddingLeft: "16px" }}>
                <For each={children()}>
                  {(ch) => (
                    <li>
                      <a href={`/card/${ch.id}/view`} onClick={(e) => { e.preventDefault(); props.onNavigate?.(ch.id); }}>
                        {cardTitle(ch)}
                      </a>
                    </li>
                  )}
                </For>
              </ul>
            </Section>
          </Show>
        </Lists>
      </PageContainer>
    </Overlay>
  );
};

const Overlay = styled("div", {
  base: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 6000,
    display: "flex",
    overflow: "auto",
  },
});

const PageContainer = styled("div", {
  base: {
    background: "#fff",
    color: "#111",
    margin: "auto",
    width: "100%",
    maxWidth: "1600px",
    minHeight: "80vh",
    borderRadius: "8px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
    padding: "24px 32px",
  },
});

const Header = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
});

const CloseBtn = styled("button", {
  base: {
    border: "1px solid #ddd",
    background: "#f6f6f6",
    color: "#333",
    borderRadius: "6px",
    padding: "4px 10px",
    cursor: "pointer",
  },
});

const Content = styled("div", {
  base: {
    lineHeight: 1.7,
    fontSize: "16px",
  },
});
const Lists = styled("div", { base: { marginTop: "24px" } });
const Section = styled("section", { base: {} });
