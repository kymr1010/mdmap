import { Card } from "../schema/Card.js";
import { Dimmension } from "../schema/Point.js";

export const buildCardMap = (cards: Card[]) => new Map(cards.map((c) => [c.id, c] as const));
export const ORIGIN: Dimmension = { x: 0, y: 0 };

export function addPos(a: Dimmension, b: Dimmension): Dimmension {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtractPos(a: Dimmension, b: Dimmension): Dimmension {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function getAbsPosFromMap(map: Map<number, Card>, id: number): Dimmension {
  const seen = new Set<number>();
  let acc: Dimmension = { ...ORIGIN };
  let cur = map.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    acc = addPos(acc, cur.position);
    cur = cur.parent_id != null ? map.get(cur.parent_id) : undefined;
  }
  return acc;
}

export function getAbsPos(cards: Card[], id: number): Dimmension {
  return getAbsPosFromMap(buildCardMap(cards), id);
}

export function toStoredPosFromAbs(
  map: Map<number, Card>,
  card: Pick<Card, "parent_id">,
  absPosition: Dimmension,
): Dimmension {
  return card.parent_id != null
    ? subtractPos(absPosition, getAbsPosFromMap(map, card.parent_id))
    : absPosition;
}

export function withStoredPosFromAbs<T extends Card>(
  map: Map<number, Card>,
  card: T,
  absPosition: Dimmension,
): T {
  return {
    ...card,
    position: toStoredPosFromAbs(map, card, absPosition),
  };
}

export function withParentFromAbs<T extends Card>(
  map: Map<number, Card>,
  card: T,
  parentId: Card["id"],
  absPosition = getAbsPosFromMap(map, card.id),
): T {
  return withStoredPosFromAbs(map, { ...card, parent_id: parentId }, absPosition);
}

export function withoutParentFromAbs<T extends Card>(
  map: Map<number, Card>,
  card: T,
): T {
  return {
    ...card,
    parent_id: undefined,
    position: getAbsPosFromMap(map, card.id),
  };
}
