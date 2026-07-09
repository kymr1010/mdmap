export const isPrivateCard = (card: { visibility?: string }) =>
  card.visibility === "private";

export const PrivateMark = (props: { visible?: boolean }) => {
  if (!props.visible) return null;
  return (
    <span
      aria-label="private"
      title="非公開"
      style={{
        "font-size": "0.72em",
        "margin-left": "0.28em",
        opacity: 0.72,
        "vertical-align": "0.08em",
      }}
    >
      {"🔒"}
    </span>
  );
};
