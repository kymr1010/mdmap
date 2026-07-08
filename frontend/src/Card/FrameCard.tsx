import { createSignal, Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { Dimmension } from "../schema/Point.js";
import { useContextMenu } from "../hooks/useContextMenu.js";
import type { MenuItem } from "../hooks/useContextMenu.js";
import type { CardProps } from "./types.js";
import {
  computeConnectHandles,
  createCommonMenuItems,
  notifyNearestConnector,
  useCommonCardInteractions,
} from "./cardInteractions.js";
import {
  getConnectHandleStyle,
  getHandleStyle,
  resizeDirs,
  StyledCard,
  StyledCardContent,
  StyledCardHeader,
} from "./cardStyles.js";

export const FrameCard = (props: CardProps) => {
  let cardRoot: HTMLDivElement | undefined;
  let headerRef: HTMLDivElement | undefined;

  const [size, setSize] = createSignal<Dimmension>({ ...props.card().size });
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

  const frameMenuItems = (): MenuItem[] =>
    props.canEdit()
      ? [{ label: "カード作成", action: () => props.onCreateCard?.() }]
      : [];
  const { onContextMenu, ContextMenu } = useContextMenu(() =>
    createCommonMenuItems(props, frameMenuItems)
  );

  useCommonCardInteractions(props, {
    cardRoot: () => cardRoot,
    dragHandle: () => headerRef,
    size,
    setSize,
    resizeHandles,
  });

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
          background: "rgba(0,0,0,0.02)",
          border: "2px dashed #9aa0a6",
          "box-shadow": "none",
          "z-index": 400,
        }}
      >
        <StyledCardHeader ref={(el) => (headerRef = el)} class="card-header">
          <div
            class="frame-title"
            style={{
              display: "inline-block",
              "font-weight": 600,
              padding: "2px 8px",
              background: "rgba(255,255,255,0.85)",
              "border-radius": "4px",
              "max-width": "100%",
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
            }}
          >
            {props.card().title || "(untitled)"}
          </div>
        </StyledCardHeader>
        <Show when={!props.isMinimized()}>
          <StyledCardContent>
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
      </StyledCard>

      <Portal>
        <ContextMenu />
      </Portal>
    </>
  );
};
