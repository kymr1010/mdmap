export type Device = "pointer" | "keyboard" | "wheel";

export type PointerButton = "left" | "middle" | "right";
export type ModKey = "Ctrl" | "Alt" | "Shift" | "Meta";

export interface Binding {
  id?: string;
  device: Device;
  event: "drag" | "down" | "click" | "doubleclick" | "wheel" | "key";
  when: string; // context name, e.g., "card", "canvas", "editor"
  action: string; // e.g., "card.move"
  args?: Record<string, unknown>;
  // Pointer specific
  button?: PointerButton;
  mods?: ModKey[];
  targetSelector?: string; // CSS selector relative to a provided root
}

export interface PointerDragCheck {
  when: string;
  action: string;
  root: HTMLElement; // root element to resolve targetSelector
  event: PointerEvent;
}

export type BindingList = Binding[];

