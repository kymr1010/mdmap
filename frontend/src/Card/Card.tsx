import { Accessor, createEffect, createSignal, onMount } from "solid-js";
import { styled } from "@macaron-css/solid";
import type { Card as CardProps } from "./Card.d.js";
import { useDrag } from "../hooks/useDrag.js";
import { Dimmension } from "../schema/Point.js";

export const Card = (props: {
  card: CardProps;
  scaleFactor: Accessor<number>;
}) => {
  let ref!: HTMLDivElement;

  const [pos, setPos] = createSignal<Dimmension>({
    x: props.card.position.x,
    y: props.card.position.y,
  });

  // マウント後にフックへ渡す
  onMount(() => {
    // console.log(props.card);
    useDrag(ref, pos, setPos, props.scaleFactor);
  });

  createEffect(() => {
    setPos({
      x: props.card.position.x,
      y: props.card.position.y,
    });
  });

  return (
    <StyledCard
      ref={ref}
      style={{
        position: "absolute",
        left: `${pos().x}px`,
        top: `${pos().y}px`,
        width: `${props.card.size.x}px`,
        height: `${props.card.size.y}px`,
      }}
    >
      <h1>{props.card.title}</h1>
      <p>
        x:{pos().x}, y:{pos().y}
      </p>
    </StyledCard>
  );
};

const StyledCard = styled("div", {
  base: {
    backgroundColor: "white",
    boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
    borderRadius: "0.75rem",
    padding: "0.75rem",
    /* 余計なブラウザのドラッグ（スクロール）を無効化 */
    touchAction: "none",
  },
});
