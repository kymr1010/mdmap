import { createSignal, onMount, onCleanup, JSX } from "solid-js";
import Tagify from "@yaireo/tagify";
import type { TagifySettings, TagifyTags } from "@yaireo/tagify";
import { styled } from "@macaron-css/solid";

interface TagInputProps {
  readOnly?: boolean;
  whitelist?: string[];
  initialTags?: string[];
  onChange?: (tags: string[]) => void;
}

export function TagInput(props: TagInputProps): JSX.Element {
  let inputRef!: HTMLInputElement;
  const [tags, setTags] = createSignal<string[]>(props.initialTags ?? []);

  let tagify: Tagify<TagifyTags>;

  onMount(() => {
    const settings: Partial<TagifySettings> = {
      whitelist: props.whitelist ?? [],
      dropdown: {
        enabled: 0, // 入力時に候補リストを自動表示
        maxItems: 20,
      },
    };

    tagify = new Tagify(inputRef, settings);

    if (props.readOnly) {
      tagify.setReadonly(true);
    }

    // 初期タグをセット
    if (tags().length) {
      tagify.loadOriginalValues(tags().map((t) => ({ value: t })));
    }

    // タグ追加・削除・入力完了時に Solid の state を更新
    tagify.on("add", () => updateTags());
    tagify.on("remove", () => updateTags());
    tagify.on("edit", () => updateTags());

    function updateTags() {
      const current = tagify.value.map((item) => item.value);
      setTags(current);
      props.onChange?.(current);
    }
  });

  onCleanup(() => {
    tagify.destroy();
  });

  return <input ref={inputRef!} placeholder="タグを入力して Enter, で追加" />;
}
