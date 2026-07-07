import { inputManager } from "./manager";

/**
 * Single-touch long-press detector.
 *
 * Emits a synthetic `contextmenu` MouseEvent on the pressed element when a
 * stationary single touch is held for `longPressMs`. This lets the existing
 * `oncontextmenu` handlers (cards and canvas) drive the context menu on touch
 * devices, mirroring a right click.
 *
 * The concrete timing / tolerances come from the InputManager gesture config,
 * so operation tuning stays centralized in the input module.
 */
export function createLongPressContextMenu() {
  let timer: number | null = null;
  let start: { x: number; y: number } | null = null;
  let target: EventTarget | null = null;

  const clear = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    start = null;
    target = null;
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    if (!inputManager.hasLongPressContextMenu()) return;
    const { longPressMs } = inputManager.getGestureConfig();
    start = { x: e.clientX, y: e.clientY };
    target = e.target;
    const x = e.clientX;
    const y = e.clientY;
    timer = window.setTimeout(() => {
      const el = target;
      clear();
      if (el instanceof Element) {
        el.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
          }),
        );
      }
    }, longPressMs);
  };

  const onMove = (e: PointerEvent) => {
    if (timer === null || !start) return;
    const { longPressMoveTolerance } = inputManager.getGestureConfig();
    if (
      Math.abs(e.clientX - start.x) > longPressMoveTolerance ||
      Math.abs(e.clientY - start.y) > longPressMoveTolerance
    ) {
      clear();
    }
  };

  const onEnd = () => clear();

  return { onDown, onMove, onEnd, cancel: clear };
}
