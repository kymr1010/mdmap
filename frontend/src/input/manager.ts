import { defaultBindings, defaultGestureConfig } from "./defaultBindings";
import type {
  Binding,
  BindingList,
  GestureConfig,
  ModKey,
  PointerDragCheck,
  WheelCheck,
} from "./types";

function getMods(e: KeyboardEvent | MouseEvent | PointerEvent | WheelEvent): ModKey[] {
  const mods: ModKey[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  // meta is Command on macOS, Windows key otherwise
  if ((e as any).metaKey) mods.push("Meta");
  return mods;
}

function pointerButtonName(e: PointerEvent): "left" | "middle" | "right" {
  switch (e.button) {
    case 0:
      return "left";
    case 1:
      return "middle";
    case 2:
      return "right";
    default:
      return "left";
  }
}

/** true when eventTarget is (or is inside) an element matching selector under root. */
function targetWithin(
  root: HTMLElement,
  eventTarget: EventTarget | null,
  selector: string,
): boolean {
  if (!(eventTarget instanceof Node)) return false;
  const candidates = Array.from(root.querySelectorAll(selector));
  return candidates.some((el) => el === eventTarget || el.contains(eventTarget));
}

/** Check a binding's target/exclude selector constraints against an event target. */
function selectorsMatch(root: HTMLElement, target: EventTarget | null, b: Binding): boolean {
  if (b.targetSelector && !targetWithin(root, target, b.targetSelector)) return false;
  if (b.excludeSelector && targetWithin(root, target, b.excludeSelector)) return false;
  return true;
}

function modsMatch(b: Binding, mods: ModKey[]): boolean {
  if (!b.mods) return true; // no constraint => any modifiers accepted
  return b.mods.length === mods.length && b.mods.every((m) => mods.includes(m));
}

export class InputManager {
  private bindings: BindingList = [];
  private gesture: GestureConfig = { ...defaultGestureConfig };

  constructor() {
    this.bindings = [...defaultBindings];
  }

  load(bindings: BindingList, gesture?: GestureConfig) {
    this.bindings = [...bindings];
    if (gesture) this.gesture = { ...gesture };
  }

  getBindings() {
    return this.bindings;
  }

  getGestureConfig(): GestureConfig {
    return this.gesture;
  }

  /** Whether a pointer drag with the given context should start (e.g. card.move). */
  canStartPointerDrag(check: PointerDragCheck): boolean {
    const btn = pointerButtonName(check.event);
    const mods = getMods(check.event);
    return this.bindings.some((b) => {
      if (b.device !== "pointer" || b.event !== "drag") return false;
      if (b.when !== check.when) return false;
      if (b.action !== check.action) return false;
      if (b.button && b.button !== btn) return false;
      if (!modsMatch(b, mods)) return false;
      return selectorsMatch(check.root, check.event.target, b);
    });
  }

  /**
   * Whether a pointer press should start a canvas pan (view.pan).
   * Used so that pressing on a card's non-text area still lets you move the page.
   */
  canStartCanvasPan(check: Omit<PointerDragCheck, "when" | "action">): boolean {
    return this.canStartPointerDrag({ ...check, when: "canvas", action: "view.pan" });
  }

  /** Resolve which action a wheel event maps to in the given context (or null). */
  resolveWheelAction(check: WheelCheck): string | null {
    const mods = getMods(check.event);
    const match = this.bindings.find((b) => {
      if (b.device !== "wheel" || b.event !== "wheel") return false;
      if (b.when !== check.when) return false;
      return modsMatch(b, mods);
    });
    return match ? match.action : null;
  }

  /** Number of touch points bound to the canvas scroll/zoom gesture. */
  scrollPointers(): number {
    const b = this.bindings.find(
      (x) => x.device === "touch" && x.event === "gesture" && x.action === "view.scroll",
    );
    return b?.pointers ?? this.gesture.scrollPointers;
  }

  /** Whether a single-touch long press is bound to open the context menu. */
  hasLongPressContextMenu(): boolean {
    return this.bindings.some(
      (b) =>
        b.device === "touch" &&
        b.event === "longpress" &&
        b.action === "contextmenu.open",
    );
  }
}

export const inputManager = new InputManager();
