import { Accessor, createSignal, onCleanup } from "solid-js";
import { Dimmension } from "../schema/Point.js";
import { Card } from "../schema/Card.js";
import { Path } from "../schema/Connrctor.js";

export function useConnector(props: {
  mousePosition: Accessor<Dimmension>;
  onUpCallback: (fromID: Card["id"]) => void;
}) {
  const [currentLine, setCurrentLine] = createSignal<{
    from: Dimmension;
    to: Dimmension;
  } | null>(null);

  let startX = 0,
    startY = 0,
    fromId: number;

  function startConnect(e: PointerEvent, pos: Dimmension, cardId: Card["id"]) {
    e.stopPropagation();
    console.log("startConnect");
    startX = pos.x;
    startY = pos.y;
    fromId = cardId;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onMove(e: PointerEvent) {
    setCurrentLine({
      from: { x: startX, y: startY },
      to: { x: props.mousePosition().x, y: props.mousePosition().y },
    });
    // console.log("onMove", currentLine());
  }

  function onUp(e: PointerEvent) {
    console.log("onUp");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    props.onUpCallback(fromId);
    setCurrentLine(null);
  }

  return {
    currentLine,
    startConnect,
  };
}
