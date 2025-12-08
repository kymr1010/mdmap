import type { BindingList } from "./types";

export const defaultBindings: BindingList = [
  // Drag card by header
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
  // Drag card by markdown H1 inside content
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
  // View zoom with ctrl+wheel (placeholder for container integration)
  {
    id: "view-zoom-ctrl-wheel",
    device: "wheel",
    event: "wheel",
    when: "canvas",
    action: "view.zoom",
    mods: ["Ctrl"],
  },
];

