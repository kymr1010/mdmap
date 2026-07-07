export type Device = "pointer" | "keyboard" | "wheel" | "touch";

export type PointerButton = "left" | "middle" | "right";
export type ModKey = "Ctrl" | "Alt" | "Shift" | "Meta";

export type InputEventType =
  | "drag"
  | "down"
  | "click"
  | "doubleclick"
  | "wheel"
  | "key"
  | "longpress"
  | "gesture";

export interface Binding {
  id?: string;
  device: Device;
  event: InputEventType;
  when: string; // context name, e.g., "card", "canvas", "any"
  action: string; // e.g., "card.move"
  args?: Record<string, unknown>;
  // Pointer specific
  button?: PointerButton;
  mods?: ModKey[];
  /** target must be inside an element matching this selector (relative to a provided root) */
  targetSelector?: string;
  /** target must NOT be inside an element matching this selector */
  excludeSelector?: string;
  /** number of simultaneous touch points for touch/gesture bindings */
  pointers?: number;
}

export interface PointerDragCheck {
  when: string;
  action: string;
  root: HTMLElement; // root element to resolve target selectors
  event: PointerEvent;
}

export interface WheelCheck {
  when: string;
  event: WheelEvent;
}

/** Tunable parameters for touch/pointer gestures. */
export interface GestureConfig {
  /** how long (ms) a stationary single touch must be held to trigger a long-press */
  longPressMs: number;
  /** movement (px) beyond which a long-press is cancelled */
  longPressMoveTolerance: number;
  /** number of touch points that trigger canvas scroll/zoom */
  scrollPointers: number;
}

export type BindingList = Binding[];
