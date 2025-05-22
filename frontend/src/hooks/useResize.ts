// src/hooks/useResize.ts
import { onCleanup, onMount } from "solid-js";
import type { Dimmension } from "../schema/Point.js";

type Direction = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function useResize(
  handleEl: HTMLElement,
  direction: Direction,
  getPos: () => Dimmension,
  setPos: (p: Dimmension) => void,
  getSize: () => Dimmension,
  setSize: (s: Dimmension) => void,
  getScale: () => number,
  minSize: Dimmension = { x: 20, y: 20 }
) {
  let originMouse: { x: number; y: number };
  let originPos: Dimmension;
  let originSize: Dimmension;

  onMount(() => {
    handleEl.style.touchAction = "none";
    handleEl.addEventListener("pointerdown", onPointerDown);
  });

  function onPointerDown(e: PointerEvent) {
    // e.stopPropagation();
    handleEl.setPointerCapture(e.pointerId);
    originMouse = { x: e.clientX, y: e.clientY };
    originPos = getPos();
    originSize = getSize();

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onPointerMove(e: PointerEvent) {
    const dx = (e.clientX - originMouse.x) / getScale();
    const dy = (e.clientY - originMouse.y) / getScale();

    let { x: nx, y: ny } = originPos;
    let { x: nw, y: nh } = originSize;

    if (direction.includes("e")) nw = Math.max(minSize.x, originSize.x + dx);
    if (direction.includes("s")) nh = Math.max(minSize.y, originSize.y + dy);
    if (direction.includes("w")) {
      nw = Math.max(minSize.x, originSize.x - dx);
      nx = originPos.x + dx;
    }
    if (direction.includes("n")) {
      nh = Math.max(minSize.y, originSize.y - dy);
      ny = originPos.y + dy;
    }

    setSize({ x: nw, y: nh });
    setPos({ x: nx, y: ny });
  }

  function onPointerUp(e: PointerEvent) {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    handleEl.releasePointerCapture(e.pointerId);
  }

  onCleanup(() => {
    handleEl.removeEventListener("pointerdown", onPointerDown);
  });
}
