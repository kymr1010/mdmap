import { styled } from "@macaron-css/solid";
import EasyMDE from "easymde";
import {
  Accessor,
  createEffect,
  createSignal,
  on,
  onMount,
  Setter,
  Show,
} from "solid-js";
import { Card as CardProps } from "../schema/Card.js";

type EditorPanelProps = {
  card: Accessor<CardProps | null>;
  setCard: (card: CardProps) => void;
  onSave: (card: CardProps) => void;
  onCancel: () => void;
};

export const EditorPanel = (props: EditorPanelProps) => {
  let ref = undefined as HTMLTextAreaElement | undefined;
  let easyMDE: EasyMDE;
  const [isOpen, setIsOpen] = createSignal(false);
  const [initialCard, setInitialCard] = createSignal<CardProps>();

  createEffect(
    on(
      () => props.card(),
      (newCard) => {
        if (easyMDE && newCard && newCard.id !== initialCard()?.id) {
          console.log(newCard);
          setInitialCard(newCard);
          setIsOpen(true);
          easyMDE.value(newCard.contents);
        }
      }
    )
  );

  onMount(() => {
    easyMDE = new EasyMDE({
      element: ref!,
      hideIcons: ["guide", "fullscreen"],
    });
    // 初回セット
    easyMDE.value(props.card()?.contents || "");
    easyMDE.codemirror.on("change", () => {
      const card: CardProps = {
        ...props.card(),
        contents: easyMDE.value(),
      };
      props.setCard(card);
    });
  });

  return (
    <StyledPanel open={isOpen()}>
      <h2>カードを編集{props.card()?.contents}</h2>
      <label>
        タイトル
        <input
          type="text"
          value={props.card()?.title}
          onInput={(e) => {
            if (props.card())
              props.setCard({
                ...props.card(),
                title: e.currentTarget.value,
              });
          }}
          style={{ width: "100%", "margin-bottom": "1rem" }}
        />
      </label>
      <label>
        コンテンツ (Markdown)
        <textarea
          ref={ref}
          style={{
            width: "100%",
            height: "40vh",
            "margin-bottom": "1rem",
            "font-family": "monospace",
          }}
        />
      </label>
      <button
        onClick={() => {
          console.log(props.card());
          props.setCard(props.card()!);
          props.onSave(props.card()!);
          setInitialCard(undefined);
          setIsOpen(false);
        }}
      >
        save
      </button>
      <button
        onClick={() => {
          props.setCard(initialCard()!);
          props.onSave(initialCard()!);
          props.onCancel();
          setInitialCard(undefined);
          setIsOpen(false);
        }}
      >
        cancel
      </button>
    </StyledPanel>
  );
};

const StyledPanel = styled("div", {
  base: {
    position: "fixed",
    top: 0,
    width: "50vw",
    height: "100vh",
    padding: "1rem",
    background: "white",
    boxShadow: "-4px 0 8px rgba(0,0,0,0.2)",
    overflow: "auto",
    zIndex: 2000,
    transition: "all 0.3s ease-in-out",
  },
  variants: {
    open: {
      false: { right: "-50vw" },
      true: { right: "0" },
    },
  },
  defaultVariants: {
    open: false,
  },
});
