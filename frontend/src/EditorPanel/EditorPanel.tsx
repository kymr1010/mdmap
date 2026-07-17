import { styled } from "@macaron-css/solid";
import { globalStyle } from "@macaron-css/core";
import EasyMDE from "easymde";
import {
  Accessor,
  createEffect,
  createSignal,
  on,
  onMount,
  Setter,
  Show,
  untrack,
} from "solid-js";
import { Card as CardProps } from "../schema/Card.js";
import { extractFirstH1 } from "../utils/markdown.js";
import { TagInput } from "../Tag/Tag.jsx";
import type { Tag } from "../schema/Tag.js";
import { getTags, createTag as apiCreateTag } from "../hooks/useTagAPI.js";
import { isPrivateCard, PrivateMark } from "../Card/PrivateMark.jsx";

type EditorPanelProps = {
  card: Accessor<CardProps | null>;
  setCard: (card: CardProps) => void;
  onSave: (card: CardProps, previousCard?: CardProps) => void | Promise<void>;
  onCancel: () => void;
};

// Render the editor as plain text: neutralize the Markdown token styling that
// EasyMDE / CodeMirror applies (headers, bold, emphasis, links, quotes...), so
// the edit form shows raw Markdown without any visual formatting.
const CM_MARKDOWN_TOKENS = [
  ".cm-header",
  ".cm-header-1",
  ".cm-header-2",
  ".cm-header-3",
  ".cm-header-4",
  ".cm-header-5",
  ".cm-header-6",
  ".cm-strong",
  ".cm-em",
  ".cm-quote",
  ".cm-link",
  ".cm-url",
  ".cm-image",
  ".cm-strikethrough",
  ".cm-comment",
  ".cm-formatting",
]
  .map((t) => `.EasyMDEContainer .CodeMirror ${t}`)
  .join(", ");

globalStyle(CM_MARKDOWN_TOKENS, {
  fontSize: "inherit !important",
  fontWeight: "inherit !important",
  fontStyle: "normal !important",
  fontFamily: "inherit !important",
  lineHeight: "inherit !important",
  color: "inherit !important",
  textDecoration: "none !important",
  background: "none !important",
});

globalStyle(".EasyMDEContainer .CodeMirror .cm-spell-error", {
  color: "inherit !important",
  background: "none !important",
  textDecoration: "none !important",
});

globalStyle(
  ".EasyMDEContainer .CodeMirror .cm-error, .EasyMDEContainer .CodeMirror .cm-invalidchar",
  {
    color: "inherit !important",
    background: "none !important",
    textDecoration: "none !important",
  },
);

export const EditorPanel = (props: EditorPanelProps) => {
  let ref = undefined as HTMLTextAreaElement | undefined;
  let easyMDE: EasyMDE;
  const [isOpen, setIsOpen] = createSignal(false);
  const [initialCard, setInitialCard] = createSignal<CardProps>();
  const [allTags, setAllTags] = createSignal<Tag[]>([]);
  const [selectedTagNames, setSelectedTagNames] = createSignal<string[]>([]);
  const [isEditingTags, setIsEditingTags] = createSignal(false);

  const tagNamesFromCard = (card: CardProps, tags: Tag[]) => {
    const map = new Map(tags.map((t) => [t.id, t.name] as const));
    return (card.tag_ids || []).map((id) => map.get(id)).filter(Boolean) as string[];
  };

  createEffect(
    on(
      () => props.card(),
      (newCard) => {
        if (easyMDE && newCard && newCard.id !== initialCard()?.id) {
          console.log(newCard);
          setInitialCard(newCard);
          setIsOpen(true);
          easyMDE.value(newCard.contents);
          setSelectedTagNames(tagNamesFromCard(newCard, allTags()));
        }
      }
    )
  );

  // When tag list changes while an editor is open, recompute selected names
  createEffect(
    on(allTags, () => {
      if (untrack(isEditingTags)) return;
      const c = props.card();
      if (!c) return;
      setSelectedTagNames(tagNamesFromCard(c, allTags()));
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
      spellChecker: false,
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
      <h2>
        カードを編集: {props.card()?.title || "(untitled)"}
        <PrivateMark visible={props.card() ? isPrivateCard(props.card()!) : false} />
      </h2>
      {/* Title input removed: title is derived from first H1 */}
      <label>
        コンテンツ (Markdown)
        <textarea
          ref={ref}
          spellcheck={false}
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
            setIsEditingTags(true);
            setSelectedTagNames(names);
            // map current list
            let nameToId = new Map(allTags().map((t) => [t.name, t.id] as const));
            const unknown = names.filter((n) => n.trim().length > 0 && !nameToId.has(n));
            if (unknown.length > 0) {
              const createdTags: Tag[] = [];
              for (const n of unknown) {
                try {
                  const created = await apiCreateTag(n);
                  createdTags.push(created);
                  nameToId.set(created.name, created.id);
                } catch (e) {
                  console.error("createTag failed", e);
                }
              }
              if (createdTags.length > 0) {
                setAllTags((prev) => {
                  const byId = new Map(prev.map((t) => [t.id, t] as const));
                  for (const tag of createdTags) byId.set(tag.id, tag);
                  return Array.from(byId.values());
                });
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
            setIsEditingTags(false);
          }}
        />
      </div>
      <div style={{ "margin-bottom": "1rem" }}>
        <label>
          公開範囲
          <select
            value={props.card()?.visibility ?? "public"}
            onChange={(e) => {
              const c = props.card();
              if (!c) return;
              props.setCard({
                ...c,
                visibility: e.currentTarget.value as CardProps["visibility"],
              });
            }}
            style={{
              display: "block",
              "margin-top": "0.25rem",
              padding: "4px 6px",
            }}
          >
            <option value="public">公開（全員に表示）</option>
            <option value="private">非公開（管理者のみ）</option>
          </select>
        </label>
      </div>
      <div style={{ "margin-bottom": "1rem" }}>
        <label>
          カード種別
          <select
            value={props.card()?.card_type ?? "normal"}
            onChange={(e) => {
              const c = props.card();
              if (!c) return;
              props.setCard({
                ...c,
                card_type: e.currentTarget.value as CardProps["card_type"],
              });
            }}
            style={{
              display: "block",
              "margin-top": "0.25rem",
              padding: "4px 6px",
            }}
          >
            <option value="normal">通常カード</option>
            <option value="frame">枠（領域内に作成したカードを子にする）</option>
          </select>
        </label>
      </div>
      <button
        onClick={() => {
          console.log(props.card());
          props.setCard(props.card()!);
          props.onSave(props.card()!, initialCard());
          setInitialCard(undefined);
          setIsOpen(false);
        }}
      >
        save
      </button>
      <button
        onClick={() => {
          props.setCard(initialCard()!);
          props.onSave(initialCard()!, initialCard());
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
