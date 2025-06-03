import { Path } from "../schema/Path.js";

export const Connector = (props: Path) => {
  const pointsString = (props.c.points ?? [])
    .map(({ c, p }) => `S${p.x} ${p.y},${c.x} ${c.y}`)
    .join(",");
  const pathString = () =>
    `M${props.from.x} ${props.from.y} C${props.c.from.x} ${props.c.from.y}, ${props.c.to.x} ${props.c.to.y}, ${props.to.x} ${props.to.y}`;

  return <path d={pathString()} stroke="black" fill="none" />;
};
