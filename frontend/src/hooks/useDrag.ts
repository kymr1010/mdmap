import { onCleanup } from "solid-js";
import { Dimmension } from "../schema/Point.js";

// ref: ドラッグ対象の要素
// getPos: 現在位置を返すシグナルの getter
// setPos: 位置を更新するシグナルの setter
export function useDrag(
  ref: HTMLElement,
  getPos: () => Dimmension,
  setPos: (pos: Dimmension) => void,
  scaleFactor: () => number
) {
  // タッチデバイスでの既定の “パン” を無効化
  ref.style.touchAction = "none";

  let origin: Dimmension = { x: 0, y: 0 };

  const onPointerDown = (e: PointerEvent) => {
    // 重なっている要素への伝播を止める
    e.stopPropagation();
    e.preventDefault();

    // この要素にポインタをキャプチャ（ムーブ／アップもこの要素で受ける）
    ref.setPointerCapture(e.pointerId);

    // マウス座標と要素左上とのオフセットを記憶
    const pos = getPos();
    origin = {
      x: Math.floor(e.clientX / scaleFactor() - pos.x),
      y: Math.floor(e.clientY / scaleFactor() - pos.y),
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    // origin を引いた位置をセット
    setPos({
      x: Math.floor(e.clientX / scaleFactor() - origin.x),
      y: Math.floor(e.clientY / scaleFactor() - origin.y),
    });
  };

  const onPointerUp = (e: PointerEvent) => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);

    ref.releasePointerCapture(e.pointerId);
  };

  // 要素にドラッグ開始のイベントを登録
  ref.addEventListener("pointerdown", onPointerDown);

  // コンポーネントがアンマウントされるときに全てクリア
  onCleanup(() => {
    ref.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  });
}
