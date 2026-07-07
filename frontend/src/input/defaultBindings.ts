import type { BindingList, GestureConfig } from "./types";

/**
 * Selectors that represent "text / interactive" parts of a card.
 * Pressing on these should NOT start a canvas pan (they have their own behavior:
 * card move via header/H1, resizing, connecting, form controls, links...).
 */
export const CARD_INTERACTIVE_SELECTOR =
  ".card-header, .markdown-body, .resize-handle, .connect-handle, a, button, input, textarea, select";

export const defaultBindings: BindingList = [
  // ---- Card ----
  // Move card by dragging its header bar
  {
    id: "card-move-header",
    device: "pointer",
    event: "drag",
    when: "card",
    action: "card.move",
    button: "left",
    mods: [],
    targetSelector: ".card-header",
  },
  // Move card by dragging the markdown H1 inside its content
  {
    id: "card-move-h1",
    device: "pointer",
    event: "drag",
    when: "card",
    action: "card.move",
    button: "left",
    mods: [],
    targetSelector: ".markdown-body h1",
  },

  // ---- Canvas (page) ----
  // Pan the whole page by dragging anywhere that is NOT a text/interactive part.
  // This makes cards that cover the screen still let you move the canvas.
  {
    id: "view-pan-drag",
    device: "pointer",
    event: "drag",
    when: "canvas",
    action: "view.pan",
    button: "left",
    mods: [],
    excludeSelector: CARD_INTERACTIVE_SELECTOR,
  },
  // Ctrl + wheel zooms. On a trackpad a pinch gesture is delivered by the
  // browser as a wheel event with ctrlKey set, so this also covers pinch-zoom.
  {
    id: "view-zoom-wheel",
    device: "wheel",
    event: "wheel",
    when: "canvas",
    action: "view.zoom",
    mods: ["Ctrl"],
  },
  // Plain wheel / two-finger trackpad scroll pans (scrolls) the canvas.
  {
    id: "view-scroll-wheel",
    device: "wheel",
    event: "wheel",
    when: "canvas",
    action: "view.scroll",
    mods: [],
  },

  // ---- Context menu ----
  // Right click opens the context menu (handled natively via `contextmenu`)
  {
    id: "contextmenu-right",
    device: "pointer",
    event: "down",
    when: "any",
    action: "contextmenu.open",
    button: "right",
  },
  // Long press with a single touch opens the context menu
  {
    id: "contextmenu-longpress",
    device: "touch",
    event: "longpress",
    when: "any",
    action: "contextmenu.open",
    pointers: 1,
  },

  // ---- Touch gestures ----
  // Two-finger drag scrolls (pans) / zooms the canvas
  {
    id: "view-scroll-two-finger",
    device: "touch",
    event: "gesture",
    when: "canvas",
    action: "view.scroll",
    pointers: 2,
  },
];

export const defaultGestureConfig: GestureConfig = {
  longPressMs: 500,
  longPressMoveTolerance: 10,
  scrollPointers: 2,
};
