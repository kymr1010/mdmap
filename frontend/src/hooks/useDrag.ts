import { onCleanup } from "solid-js";
import { Dimmension } from "../schema/Point.js";

// ref: ドラッグ対象の要素
// getPos: 現在位置を返すシグナルの getter
// setPos: 位置を更新するシグナルの setter
export function useDrag(props: {
  // Accepts direct element or a getter returning the element later
  ref: HTMLElement | (() => HTMLElement | null | undefined);
  getPos: () => Dimmension;
  setPos: (pos: Dimmension) => void;
  scaleFactor: () => number;
  moveCallback?: (pos: Dimmension) => void;
  upCallback?: (diff: Dimmension) => void;
  /**
   * If true (default), starts drag only when pointerdown target === ref.
   * If false, allows pointerdown on any descendant of ref.
   */
  strictTarget?: boolean;
  /** optional guard to decide whether to start dragging */
  startGuard?: (e: PointerEvent, el: HTMLElement) => boolean;
}) {
  let el: HTMLElement | null = null;
  let rafId: number | null = null;

  const resolveRef = (): HTMLElement | null => {
    return typeof props.ref === "function" ? (props.ref() as HTMLElement | null) : (props.ref as HTMLElement);
  };

  const attach = () => {
    if (el) return; // already attached
    const node = resolveRef();
    if (!node) {
      // try again on next frame
      rafId = window.requestAnimationFrame(attach);
      return;
    }
    el = node;
    // タッチデバイスでの既定の “パン” を無効化
    el.style.touchAction = "none";
    // 要素にドラッグ開始のイベントを登録
    el.addEventListener("pointerdown", onPointerDown);
  };

  let origin: Dimmension = { x: 0, y: 0 };
  let beforePos: Dimmension = { x: 0, y: 0 };

  const onPointerDown = (e: PointerEvent) => {
    // 重なっている要素への伝播を止める
    if (!el) return;
    if (e.button !== 0) return;
    const strict = props.strictTarget ?? true;
    if (strict) {
      if (e.target !== el) return;
    } else {
      if (!(e.target instanceof Node) || !el.contains(e.target)) return;
    }
    if (props.startGuard && !props.startGuard(e, el)) return;
    // e.stopPropagation();
    // e.preventDefault();

    // この要素にポインタをキャプチャ（ムーブ／アップもこの要素で受ける）
    el.setPointerCapture(e.pointerId);

    // 位置を記憶
    beforePos = props.getPos();

    // マウス座標と要素左上とのオフセットを記憶
    const pos = props.getPos();

    origin = {
      x: Math.floor(e.clientX / props.scaleFactor() - pos.x),
      y: Math.floor(e.clientY / props.scaleFactor() - pos.y),
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    // 計算済みの新しい位置（origin を差し引く）
    const next = {
      x: Math.floor(e.clientX / props.scaleFactor() - origin.x),
      y: Math.floor(e.clientY / props.scaleFactor() - origin.y),
    };
    // 要素位置を更新
    props.setPos(next);
    // ドラッグ開始からの差分（クリック位置補正後）
    if (props.moveCallback !== undefined)
      props.moveCallback({
        x: next.x - beforePos.x,
        y: next.y - beforePos.y,
      });
  };

  const onPointerUp = (e: PointerEvent) => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if (props.upCallback !== undefined) {
      const next = {
        x: Math.floor(e.clientX / props.scaleFactor() - origin.x),
        y: Math.floor(e.clientY / props.scaleFactor() - origin.y),
      };
      props.upCallback({
        x: next.x - beforePos.x,
        y: next.y - beforePos.y,
      });
    }
    if (el) el.releasePointerCapture(e.pointerId);
  };

  // 初期アタッチ（ref が未設定でも再試行）
  attach();

  // コンポーネントがアンマウントされるときに全てクリア
  onCleanup(() => {
    if (rafId !== null) window.cancelAnimationFrame(rafId);
    if (el) el.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  });
}
