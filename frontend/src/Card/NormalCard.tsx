import { createSignal, Show } from "solid-js";
import { Portal } from "solid-js/web";
import DOMPurify from "dompurify";
import { marked } from "marked";
import type { Card } from "../schema/Card.js";
import { extractFirstH1 } from "../utils/markdown.js";
import { useContextMenu } from "../hooks/useContextMenu.js";
import type { Dimmension } from "../schema/Point.js";
import type { CardProps } from "./types.js";
import {
  computeConnectHandles,
  createCommonMenuItems,
  notifyNearestConnector,
  persistCardUpdate,
  useCommonCardInteractions,
} from "./cardInteractions.js";
import {
  getConnectHandleStyle,
  getHandleStyle,
  resizeDirs,
  StyledCard,
  StyledCardContent,
  StyledCardFooter,
  StyledCardHeader,
} from "./cardStyles.js";

export const NormalCard = (props: CardProps) => {
  let cardRoot: HTMLDivElement | undefined;
  let headerRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;

  const [size, setSize] = createSignal<Dimmension>({ ...props.card().size });
  const [contents, setContents] = createSignal(props.card().contents);
  const [inlineEditing, setInlineEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  const [isHovered, setIsHovered] = createSignal(false);
  const resizeHandles: Record<(typeof resizeDirs)[number], HTMLDivElement | undefined> = {
    n: undefined,
    s: undefined,
    e: undefined,
    w: undefined,
    ne: undefined,
    nw: undefined,
    se: undefined,
    sw: undefined,
  };

  const { onContextMenu, ContextMenu } = useContextMenu(() =>
    createCommonMenuItems(props)
  );

  useCommonCardInteractions(props, {
    cardRoot: () => cardRoot,
    dragHandle: () => headerRef,
    h1DragRoot: () => (inlineEditing() ? undefined : contentRef),
    h1DragDependency: contents,
    size,
    setSize,
    resizeHandles,
  });

  const startInlineEdit = () => {
    if (inlineEditing()) return;
    if (!props.canEdit() || props.isMinimized()) return;
    setDraft(props.card().contents ?? "");
    setInlineEditing(true);
  };

  const persistContents = (newContents: string) => {
    if (newContents === (props.card().contents ?? "")) return;
    setContents(newContents);
    const updated: Card = {
      ...props.card(),
      contents: newContents,
      title: extractFirstH1(newContents) ?? "",
      position: props.nodePosition(),
    };
    persistCardUpdate(props, updated);
  };

  const exitInlineEdit = (commit: boolean) => {
    if (!inlineEditing()) return;
    const nextDraft = draft();
    setInlineEditing(false);
    if (commit) persistContents(nextDraft);
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
          props.onLeave();
        }}
        style={{
          position: "absolute",
          width: `${size().x}px`,
          height: props.isMinimized() ? undefined : `${size().y}px`,
        }}
        macaronHover={isHovered() ? "hover" : undefined}
      >
        <StyledCardHeader ref={(el) => (headerRef = el)} class="card-header">
          <Show when={props.isMinimized()}>
            <div
              style={{
                "font-weight": 600,
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}
            >
              {props.card().title || "(untitled)"}
            </div>
          </Show>
        </StyledCardHeader>
        <Show when={!props.isMinimized()}>
          <StyledCardContent>
            <div
              ref={(el) => (contentRef = el)}
              style={{ height: "100%" }}
              onDblClick={startInlineEdit}
            >
              <Show
                when={inlineEditing()}
                fallback={
                  <div
                    class="markdown-body"
                    innerHTML={DOMPurify.sanitize(marked(contents() || "")) || ""}
                  />
                }
              >
                <textarea
                  ref={(el) => {
                    el.value = draft();
                    requestAnimationFrame(() => el.focus());
                  }}
                  onInput={(e) => setDraft(e.currentTarget.value)}
                  onBlur={() => exitInlineEdit(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      exitInlineEdit(false);
                    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      exitInlineEdit(true);
                    }
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    "box-sizing": "border-box",
                    resize: "none",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "inherit",
                    "font-family": "monospace",
                    "font-size": "13px",
                    "line-height": 1.5,
                    "white-space": "pre-wrap",
                    "user-select": "text",
                    "-webkit-user-select": "text",
                    "touch-action": "auto",
                  }}
                />
              </Show>
            </div>
            <Show when={props.canEdit()}>
              {resizeDirs.map((dir) => (
                <div
                  ref={(el) => (resizeHandles[dir] = el)}
                  class="resize-handle"
                  style={getHandleStyle(dir, size())}
                />
              ))}
              {computeConnectHandles(size(), props.cardPosition()).map(({ dir, pos }) => (
                <div
                  class="connect-handle"
                  data-dir={dir}
                  onPointerDown={(e) => props.startConnect(e, pos, props.card().id, dir)}
                  onMouseEnter={() =>
                    notifyNearestConnector(props, {
                      dir,
                      cardId: props.card().id,
                    })
                  }
                  style={getConnectHandleStyle(dir, size(), isHovered)}
                />
              ))}
            </Show>
          </StyledCardContent>
        </Show>
        <Show when={!props.isMinimized()}>
          <StyledCardFooter>
            <p> {props.card().id} -&gt; {props.card().parent_id}</p>
            <p>{props.card().created_at}</p>
            <p>{props.card().updated_at}</p>
          </StyledCardFooter>
        </Show>
      </StyledCard>

      <Portal>
        <ContextMenu />
      </Portal>
    </>
  );
};
