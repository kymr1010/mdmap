const OK_COUNT_MAX = 30;
const OK_COUNT_MIN_CHANNEL = 150;

export const okCountValue = (card: { ok_count?: number }) =>
  Math.max(0, Math.floor(card.ok_count ?? 0));

export const okCountBackground = (card: { ok_count?: number }) => {
  const ratio = Math.min(okCountValue(card), OK_COUNT_MAX) / OK_COUNT_MAX;
  const eased = 1 - Math.exp(-4 * ratio);
  const gb = Math.round(
    OK_COUNT_MIN_CHANNEL + (255 - OK_COUNT_MIN_CHANNEL) * eased,
  );
  return `rgb(255, ${gb}, ${gb})`;
};

export const OkCountMark = (props: { count: number }) => (
  <span
    title={`ok_count: ${props.count}`}
    style={{
      position: "absolute",
      top: "6px",
      right: "8px",
      "z-index": 2,
      padding: "2px 6px",
      "border-radius": "999px",
      border: "1px solid rgba(0,0,0,0.12)",
      background: "rgba(255,255,255,0.78)",
      color: "#555",
      "font-size": "11px",
      "font-weight": 700,
      "line-height": 1.2,
      "pointer-events": "none",
    }}
  >
    {props.count}
  </span>
);
