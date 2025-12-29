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
import { extractFirstH1 } from "../utils/markdown.js";
import { TagInput } from "../Tag/Tag.jsx";
import type { Tag } from "../schema/Tag.js";
import { getTags, createTag as apiCreateTag } from "../hooks/useTagAPI.js";

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
  const [allTags, setAllTags] = createSignal<Tag[]>([]);
  const [selectedTagNames, setSelectedTagNames] = createSignal<string[]>([]);

  createEffect(
    on(
      () => props.card(),
      (newCard) => {
        if (easyMDE && newCard && newCard.id !== initialCard()?.id) {
          console.log(newCard);
          setInitialCard(newCard);
          setIsOpen(true);
          easyMDE.value(newCard.contents);
          // recompute selected tag names for this card
          const map = new Map(allTags().map((t) => [t.id, t.name] as const));
          setSelectedTagNames((newCard.tag_ids || []).map((id) => map.get(id)).filter(Boolean) as string[]);
        }
      }
    )
  );

  // When tag list changes while an editor is open, recompute selected names
  createEffect(
    on(allTags, () => {
      const c = props.card();
      if (!c) return;
      const map = new Map(allTags().map((t) => [t.id, t.name] as const));
      setSelectedTagNames((c.tag_ids || []).map((id) => map.get(id)).filter(Boolean) as string[]);
    })
  );

  onMount(() => {
    // fetch tag list for whitelist
    getTags()
      .then(setAllTags)
      .catch((e) => console.error("failed to load tags", e));
    easyMDE = new EasyMDE({
      element: ref!,
      // Hide preview-related UI while editing
      hideIcons: ["guide", "fullscreen", "preview", "side-by-side"],
      // Disable preview toggle shortcuts as well
      shortcuts: {
        toggleSideBySide: null,
        toggleFullScreen: null,
        togglePreview: null,
      },
    });
    // 初回セット
    easyMDE.value(props.card()?.contents || "");
    easyMDE.codemirror.on("change", () => {
      const contents = easyMDE.value();
      const derived = extractFirstH1(contents);
      const card: CardProps = {
        ...props.card(),
        contents,
        title: derived ?? "",
      };
      props.setCard(card);
    });
  });

  return (
    <StyledPanel open={isOpen()}>
      <h2>カードを編集: {props.card()?.title || "(untitled)"}</h2>
      {/* Title input removed: title is derived from first H1 */}
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
      <div style={{ "margin-bottom": "1rem" }}>
        <label>タグ</label>
        <TagInput
          whitelist={allTags().map((t) => t.name)}
          initialTags={selectedTagNames()}
          enforceWhitelist={false}
          onChange={async (names) => {
            setSelectedTagNames(names);
            // map current list
            let nameToId = new Map(allTags().map((t) => [t.name, t.id] as const));
            const unknown = names.filter((n) => n.trim().length > 0 && !nameToId.has(n));
            if (unknown.length > 0) {
              for (const n of unknown) {
                try {
                  await apiCreateTag(n);
                } catch (e) {
                  console.error("createTag failed", e);
                }
              }
              // fetch fresh list and use it directly for mapping
              try {
                const updated = await getTags();
                setAllTags(updated);
                nameToId = new Map(updated.map((t) => [t.name, t.id] as const));
              } catch (e) {
                console.error("getTags failed", e);
              }
            }
            const ids = names
              .map((n) => nameToId.get(n))
              .filter((v): v is number => typeof v === "number");
            if (props.card()) {
              const prevIds = props.card()!.tag_ids || [];
              const sameLen = prevIds.length === ids.length;
              const sameAll = sameLen && prevIds.every((v, i) => v === ids[i]);
              if (!sameAll) props.setCard({ ...props.card()!, tag_ids: ids });
            }
          }}
        />
      </div>
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
