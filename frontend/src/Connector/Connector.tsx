import { Path } from "../schema/Path.js";

export const Connector = (props: { path: Path }) => {
  const pointsString = (props.path.c.points ?? [])
    .map(({ c, p }) => `S${p.x} ${p.y},${c.x} ${c.y}`)
    .join(",");
  const pathString = () =>
    `M${props.path.from.x} ${props.path.from.y} C${props.path.c.from.x} ${props.path.c.from.y}, ${props.path.c.to.x} ${props.path.c.to.y}, ${props.path.to.x} ${props.path.to.y}`;

  return <path d={pathString()} stroke="black" fill="none" />;
};
