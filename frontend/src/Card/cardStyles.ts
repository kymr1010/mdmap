import { styled } from "@macaron-css/solid";
import type { JSX } from "solid-js";
import type { Dir, Dir8 } from "../schema/Card.js";
import type { Dimmension } from "../schema/Point.js";

export const resizeDirs = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;

export const getHandleStyle = (
  direction: Dir8,
  size: Dimmension
): JSX.CSSProperties => {
  const half = 0;
  const handleSize = 10;
  const cursorMap: Record<Dir8, string> = {
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    nw: "nwse-resize",
    se: "nwse-resize",
  };
  const styles: Record<Dir8, JSX.CSSProperties> = {
    n: {
      top: `${half}px`,
      left: `${handleSize}px`,
      height: `${handleSize}px`,
      width: `${size.x - 2 * handleSize}px`,
    },
    s: {
      bottom: `${half}px`,
      left: `${handleSize}px`,
      height: `${handleSize}px`,
      width: `${size.x - 2 * handleSize}px`,
    },
    e: {
      top: `${handleSize}px`,
      right: `${half}px`,
      height: `${size.y - 2 * handleSize}px`,
      width: `${handleSize}px`,
    },
    w: {
      top: `${handleSize}px`,
      left: `${half}px`,
      height: `${size.y - 2 * handleSize}px`,
      width: `${handleSize}px`,
    },
    ne: {
      top: `${half}px`,
      right: `${half}px`,
      height: `${handleSize}px`,
      width: `${handleSize}px`,
    },
    nw: {
      top: `${half}px`,
      left: `${half}px`,
      height: `${handleSize}px`,
      width: `${handleSize}px`,
    },
    se: {
      bottom: `${half}px`,
      right: `${half}px`,
      height: `${handleSize}px`,
      width: `${handleSize}px`,
    },
    sw: {
      bottom: `${half}px`,
      left: `${half}px`,
      height: `${handleSize}px`,
      width: `${handleSize}px`,
    },
  };
  return {
    position: "absolute",
    "z-index": 1000,
    cursor: cursorMap[direction],
    width: `${handleSize}px`,
    height: `${handleSize}px`,
    ...styles[direction],
  };
};

const CONNECT_HANDLE_SIZE = 20;
export const getConnectHandleStyle = (
  direction: Dir,
  size: Dimmension,
  isHovered: () => boolean
): JSX.CSSProperties => {
  const half = CONNECT_HANDLE_SIZE / 2;
  const centerX = size.x / 2 - half;
  const centerY = size.y / 2 - half;

  const base: JSX.CSSProperties = {
    position: "absolute",
    display: isHovered() ? "block" : "none",
    width: `${CONNECT_HANDLE_SIZE}px`,
    height: `${CONNECT_HANDLE_SIZE}px`,
    "border-radius": `${CONNECT_HANDLE_SIZE / 2}px`,
    cursor: "crosshair",
    "z-index": 1001,
    background: "#888",
  };

  switch (direction) {
    case "n":
      return { ...base, top: `-${half}px`, left: `${centerX}px` };
    case "s":
      return { ...base, bottom: `-${half}px`, left: `${centerX}px` };
    case "e":
      return { ...base, right: `-${half}px`, top: `${centerY}px` };
    case "w":
      return { ...base, left: `-${half}px`, top: `${centerY}px` };
  }
};

export const StyledCard = styled("div", {
  base: {
    position: "absolute",
    backgroundColor: "white",
    boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
    borderRadius: "0.75rem",
    padding: "0.75rem",
    touchAction: "none",
    userSelect: "none",
    display: "flex",
    flexDirection: "column",
    zIndex: 1000,
    "& li": {
      listStyle: "disc",
      marginLeft: "1rem",
    },
  },
  variants: {
    macaronHover: {
      hover: {
        zIndex: 1001,
        boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.3)",
      },
    },
  },
});

export const StyledCardHeader = styled("div", {
  base: {
    width: "100%",
    minHeight: "1rem",
    cursor: "grab",
  },
});

export const StyledCardFooter = styled("div", {
  base: {
    width: "100%",
    marginTop: "auto",
  },
});

export const StyledCardContent = styled("div", {
  base: {
    overflow: "hidden",
    width: "100%",
    height: "100%",
    flexGrow: 1,
    "& .markdown-body h1": {
      cursor: "grab",
    },
  },
});
