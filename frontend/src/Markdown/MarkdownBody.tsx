import { globalStyle } from "@macaron-css/core";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import "highlight.js/styles/github.css";
import { marked, Renderer } from "marked";
import mermaid from "mermaid";
import { Accessor, createEffect } from "solid-js";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
});

globalStyle(".markdown-body pre", {
  margin: "0.75rem 0",
  overflow: "auto",
  borderRadius: "6px",
});

globalStyle(".markdown-body pre code.hljs", {
  display: "block",
  padding: "0.75rem",
  fontSize: "12px",
  lineHeight: 1.5,
});

globalStyle(".markdown-body .mermaid", {
  margin: "0.75rem 0",
  padding: "0.75rem",
  overflow: "auto",
  borderRadius: "6px",
  background: "#f6f8fa",
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const languageFrom = (lang?: string) =>
  (lang || "").trim().split(/\s+/)[0]?.toLowerCase() || "";

const renderer = new Renderer();

renderer.code = ({ text, lang }) => {
  const language = languageFrom(lang);

  if (language === "mermaid") {
    return `<div class="mermaid">${escapeHtml(text)}</div>`;
  }

  if (language && hljs.getLanguage(language)) {
    const highlighted = hljs.highlight(text, {
      language,
      ignoreIllegals: true,
    }).value;
    return `<pre><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>`;
  }

  return `<pre><code>${escapeHtml(text)}</code></pre>`;
};

export const renderMarkdown = (source: string) =>
  DOMPurify.sanitize(marked.parse(source, { renderer }) as string);

type MarkdownBodyProps = {
  markdown: Accessor<string | undefined>;
  class?: string;
  classList?: Record<string, boolean>;
  onClick?: (event: MouseEvent) => void;
};

export const MarkdownBody = (props: MarkdownBodyProps) => {
  let root: HTMLDivElement | undefined;
  const html = () => renderMarkdown(props.markdown() || "");

  createEffect(() => {
    html();
    queueMicrotask(() => {
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll(".mermaid"));
      if (nodes.length === 0) return;
      mermaid.run({ nodes }).catch((error) => {
        console.error("failed to render mermaid", error);
      });
    });
  });

  return (
    <div
      ref={(el) => (root = el)}
      class={props.class}
      classList={props.classList}
      innerHTML={html()}
      onClick={props.onClick}
    />
  );
};
