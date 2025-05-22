// src/components/Card.tsx
import {
  Accessor,
  createEffect,
  createSignal,
  For,
  JSX,
  onMount,
  Show,
} from "solid-js";
import { styled } from "@macaron-css/solid";
import type { Card as CardProps } from "../schema/Card.js";
import { useDrag } from "../hooks/useDrag.js";
import { Dimmension } from "../schema/Point.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useResize } from "../hooks/useResize.js";
import { CSSProperties } from "@macaron-css/core";
import { MenuItem, useContextMenu } from "../hooks/useContextMenu.js";
import { Portal } from "solid-js/web";
import { updateCard } from "../hooks/useAPI.js";

export const Card = (props: {
  card: CardProps;
  scaleFactor: Accessor<number>;
}) => {
  let ref!: HTMLDivElement;

  // 1) 位置・サイズシグナル（既存）
  const [pos, setPos] = createSignal<Dimmension>({ ...props.card.position });
  const [size, setSize] = createSignal<Dimmension>({ ...props.card.size });

  // 2) 編集用 title/contents のローカルシグナル
  const [title, setTitle] = createSignal(props.card.title);
  const [contents, setContents] = createSignal(props.card.contents);

  // 3) 編集モードの開閉フラグ
  const [isEditing, setIsEditing] = createSignal(false);

  // 4) コンテキストメニュー
  const menuItems: MenuItem[] = [
    { label: "コピー", action: () => console.log("コピーしました") },
    {
      label: "編集",
      action: () => {
        setIsEditing(true);
      },
    },
    { label: "削除", action: () => console.log("削除しました") },
  ];
  const { onContextMenu, ContextMenu } = useContextMenu(menuItems);

  // 5) リサイズハンドル準備
  const dirs = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
  const handles = {} as Record<(typeof dirs)[number], HTMLDivElement>;

  // ドラッグ＆リサイズフックをマウント時に適用
  onMount(() => {
    useDrag(ref, pos, setPos, props.scaleFactor);
    dirs.forEach((dir) =>
      useResize(
        handles[dir],
        dir,
        pos,
        setPos,
        size,
        setSize,
        props.scaleFactor
      )
    );
  });

  // 外部 props.card が変わったら反映
  createEffect(() => setPos({ ...props.card.position }));
  createEffect(() => setSize({ ...props.card.size }));
  // （title/contents はユーザー編集で overwrite するので同期しない）

  const handleSaveCard = () => {
    updateCard({
      id: props.card.id,
      position: pos(),
      size: size(),
      title: title(),
      contents: contents(),
    });
  };

  return (
    <>
      {/* カード本体 */}
      <StyledCard
        onContextMenu={onContextMenu}
        onPointerDown={(e) => {
          console.log("Card.onPointerDown");
        }}
        style={{
          position: "absolute",
          left: `${pos().x}px`,
          top: `${pos().y}px`,
          width: `${size().x}px`,
          height: `${size().y}px`,
        }}
      >
        <div ref={ref} style={{ width: "100%", height: "1rem" }}></div>
        <div>
          <h1>{title()}</h1>
          <p>
            x:{pos().x}, y:{pos().y}
          </p>
          <div innerHTML={DOMPurify.sanitize(marked(contents())) || ""}></div>
        </div>
        {dirs.map((dir) => (
          <div
            ref={(el) => (handles[dir] = el!)}
            class="resize-handle"
            style={getHandleStyle(dir, size())}
          />
        ))}
        <ContextMenu />
      </StyledCard>

      <Portal>
        <Show when={isEditing()}>
          <EditorPanel
            initialTitle={title()}
            initialContents={contents()}
            onChangeTitle={setTitle}
            onChangeContents={setContents}
            onSave={() => {
              handleSaveCard();
              setIsEditing(false);
            }}
          />
        </Show>
      </Portal>
    </>
  );
};

// カード編集用パネルコンポーネント
type EditorPanelProps = {
  initialTitle: string;
  initialContents: string;
  onChangeTitle: (v: string) => void;
  onChangeContents: (v: string) => void;
  onSave: () => void;
};

const EditorPanel = (props: EditorPanelProps) => {
  const [localTitle, setLocalTitle] = createSignal(props.initialTitle);
  const [localContents, setLocalContents] = createSignal(props.initialContents);

  // ローカル入力を反映
  createEffect(() => props.onChangeTitle(localTitle()));
  createEffect(() => props.onChangeContents(localContents()));

  return (
    <StyledPanel>
      <h2>カードを編集</h2>
      <label>
        タイトル
        <input
          type="text"
          value={localTitle()}
          onInput={(e) => setLocalTitle(e.currentTarget.value)}
          style={{ width: "100%", "margin-bottom": "1rem" }}
        />
      </label>
      <label>
        コンテンツ (Markdown)
        <textarea
          value={localContents()}
          onInput={(e) => setLocalContents(e.currentTarget.value)}
          style={{
            width: "100%",
            height: "40vh",
            "margin-bottom": "1rem",
            "font-family": "monospace",
          }}
        />
      </label>
      <button onClick={props.onSave}>Save</button>
    </StyledPanel>
  );
};

const StyledPanel = styled("div", {
  base: {
    position: "fixed",
    top: 0,
    right: 0, // 右半分に出したい場合は right: 0; width: 50vw
    width: "50vw",
    height: "100vh",
    padding: "1rem",
    background: "white",
    boxShadow: "-4px 0 8px rgba(0,0,0,0.2)",
    overflow: "auto",
    zIndex: 2000,
    transition: "all 0.3s ease-in-out",
  },
});

// ============== 以下既存コード ===============

const getHandleStyle = (direction: string, size: Dimmension): CSSProperties => {
  const half = 0;
  const handleSize = 10;
  const cursorMap: Record<string, string> = {
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    nw: "nwse-resize",
    se: "nwse-resize",
  };
  const styles: Record<string, CSSProperties> = {
    n: {
      top: `${half}px`,
      left: `${handleSize}px`,
      height: `${handleSize}px`,
      width: `${size.x - 2 * handleSize}px`,
    },
    s: {
      bottom: `${half}px`,
      left: `${handleSize}px`,
      height: `${handleSize}px`,
      width: `${size.x - 2 * handleSize}px`,
    },
    e: {
      top: `${handleSize}px`,
      right: `${half}px`,
      height: `${size.y - 2 * handleSize}px`,
      width: `${handleSize}px`,
    },
    w: {
      top: `${handleSize}px`,
      left: `${half}px`,
      height: `${size.y - 2 * handleSize}px`,
      width: `${handleSize}px`,
    },
    ne: {
      top: `${half}px`,
      right: `${half}px`,
      height: `${handleSize}px`,
      width: `${handleSize}px`,
    },
    nw: {
      top: `${half}px`,
      left: `${half}px`,
      height: `${handleSize}px`,
      width: `${handleSize}px`,
    },
    se: {
      bottom: `${half}px`,
      right: `${half}px`,
      height: `${handleSize}px`,
      width: `${handleSize}px`,
    },
    sw: {
      bottom: `${half}px`,
      left: `${half}px`,
      height: `${handleSize}px`,
      width: `${handleSize}px`,
    },
  };
  return {
    position: "absolute",
    cursor: cursorMap[direction],
    ...styles[direction],
  };
};

const StyledCard = styled("div", {
  base: {
    position: "absolute",
    backgroundColor: "white",
    boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
    borderRadius: "0.75rem",
    padding: "0.75rem",
    overflow: "hidden",
    touchAction: "none",

    "& li": {
      listStyle: "disc",
      marginLeft: "1rem",
    },
  },
});
