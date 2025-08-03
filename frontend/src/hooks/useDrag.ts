import { Accessor, onCleanup } from "solid-js";
import { Dimmension } from "../schema/Point.js";

// ref: ドラッグ対象の要素
// getPos: 現在位置を返すシグナルの getter
// setPos: 位置を更新するシグナルの setter
export function useDrag(props: {
  ref: HTMLElement;
  getPos: () => Dimmension;
  setPos: (pos: Dimmension) => void;
  scaleFactor: () => number;
  moveCallback?: (pos: Dimmension) => void;
  upCallback?: (diff: Dimmension) => void;
}) {
  // タッチデバイスでの既定の “パン” を無効化
  props.ref.style.touchAction = "none";

  let origin: Dimmension = { x: 0, y: 0 };
  let beforePos: Dimmension = { x: 0, y: 0 };

  const onPointerDown = (e: PointerEvent) => {
    // 重なっている要素への伝播を止める
    if (e.button !== 0) return;
    if (e.target !== props.ref) return;
    // e.stopPropagation();
    // e.preventDefault();

    // この要素にポインタをキャプチャ（ムーブ／アップもこの要素で受ける）
    props.ref.setPointerCapture(e.pointerId);

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
    props.ref.releasePointerCapture(e.pointerId);
  };

  // 要素にドラッグ開始のイベントを登録
  props.ref.addEventListener("pointerdown", onPointerDown);

  // コンポーネントがアンマウントされるときに全てクリア
  onCleanup(() => {
    props.ref.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  });
}
