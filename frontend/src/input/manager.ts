import { defaultBindings } from "./defaultBindings";
import type { Binding, BindingList, ModKey, PointerDragCheck } from "./types";

function getMods(e: KeyboardEvent | MouseEvent | PointerEvent | WheelEvent): ModKey[] {
  const mods: ModKey[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  // meta is Command on macOS, Windows key otherwise
  // Note: treat meta separately from ctrl
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

function targetMatches(root: HTMLElement, eventTarget: EventTarget | null, selector?: string): boolean {
  if (!selector) return true; // no constraint
  if (!(eventTarget instanceof Node)) return false;
  const candidates = Array.from(root.querySelectorAll(selector));
  if (candidates.length === 0) return false;
  // Check if the event target is one of candidates or inside one
  return candidates.some((el) => el === eventTarget || el.contains(eventTarget));
}

export class InputManager {
  private bindings: BindingList = [];

  constructor() {
    this.bindings = [...defaultBindings];
  }

  load(bindings: BindingList) {
    this.bindings = [...bindings];
  }

  getBindings() {
    return this.bindings;
  }

  canStartPointerDrag(check: PointerDragCheck): boolean {
    const btn = pointerButtonName(check.event);
    const mods = getMods(check.event);
    return this.bindings.some((b) => {
      if (b.device !== "pointer" || b.event !== "drag") return false;
      if (b.when !== check.when) return false;
      if (b.action !== check.action) return false;
      if (b.button && b.button !== btn) return false;
      if (b.mods && (b.mods.length !== mods.length || !b.mods.every((m) => mods.includes(m)))) return false;
      return targetMatches(check.root, check.event.target, b.targetSelector);
    });
  }
}

export const inputManager = new InputManager();

