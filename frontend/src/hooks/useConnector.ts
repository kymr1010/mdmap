import { createSignal, onCleanup } from "solid-js";

type Connection = {
  from: { id: number; x: number; y: number };
  to: { id: number; x: number; y: number };
};

export function useConnector(containerRef: () => HTMLDivElement | undefined) {
  const [currentLine, setCurrentLine] = createSignal<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [connections, setConnections] = createSignal<Connection[]>([]);

  let startX = 0,
    startY = 0,
    fromId: number;

  function startConnect(e: PointerEvent, cardId: number) {
    e.stopPropagation();
    console.log("startConnect");
    const rect = containerRef()!.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    fromId = cardId;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onMove(e: PointerEvent) {
    console.log("onMove");
    const rect = containerRef()!.getBoundingClientRect();
    setCurrentLine({
      x1: startX,
      y1: startY,
      x2: e.clientX - rect.left,
      y2: e.clientY - rect.top,
    });
  }

  function onUp(e: PointerEvent) {
    console.log("onUp");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    // ヒットテスト：ドロップ先カードIDを取得
    const dropTarget = document.elementFromPoint(
      e.clientX,
      e.clientY
    ) as HTMLElement;
    const toId = dropTarget
      ?.closest(".StyledCard")
      ?.getAttribute("data-card-id");
    if (toId && +toId !== fromId) {
      setConnections([
        ...connections(),
        {
          from: { id: fromId, x: startX, y: startY },
          to: {
            id: +toId,
            x: e.clientX - containerRef()!.getBoundingClientRect().left,
            y: e.clientY - containerRef()!.getBoundingClientRect().top,
          },
        },
      ]);
    }
    setCurrentLine(null);
  }

  return {
    connections,
    currentLine,
    startConnect,
  };
}
