// Extract the first level-1 heading (H1) from Markdown text.
// Matches lines that start with a single '#' followed by a space.
export function extractFirstH1(markdown: string): string | null {
  if (!markdown) return null;
  const re = /^\s*#\s+(.+?)\s*$/m; // first H1 only
  const m = re.exec(markdown);
  return m ? m[1].trim() : null;
}

