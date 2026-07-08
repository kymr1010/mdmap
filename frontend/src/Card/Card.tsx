import type { CardProps } from "./types.js";
import { FrameCard } from "./FrameCard.jsx";
import { NormalCard } from "./NormalCard.jsx";

export type { CardProps } from "./types.js";

export const CardElm = (props: CardProps) => {
  if (props.card().card_type === "frame") {
    return <FrameCard {...props} />;
  }

  return <NormalCard {...props} />;
};
