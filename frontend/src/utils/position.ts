import { Card } from "../schema/Card.js";
import { Dimmension } from "../schema/Point.js";

export const buildCardMap = (cards: Card[]) => new Map(cards.map((c) => [c.id, c] as const));

export function getAbsPosFromMap(map: Map<number, Card>, id: number): Dimmension {
  const seen = new Set<number>();
  let acc: Dimmension = { x: 0, y: 0 };
  let cur = map.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    acc = { x: acc.x + cur.position.x, y: acc.y + cur.position.y };
    cur = cur.parent_id != null ? map.get(cur.parent_id) : undefined;
  }
  return acc;
}

export function getAbsPos(cards: Card[], id: number): Dimmension {
  return getAbsPosFromMap(buildCardMap(cards), id);
}

export function toRelativeFromMap(map: Map<number, Card>, card: Card): Card {
  if (card.parent_id == null) return card;
  const p = map.get(card.parent_id);
  if (!p) return card;
  return {
    ...card,
    position: { x: card.position.x - p.position.x, y: card.position.y - p.position.y },
  };
}

export function normalizeCardsToRelative(cards: Card[]): Card[] {
  // Expect input positions to be absolute (e.g., from DB). Convert children to be relative to direct parent.
  const map = buildCardMap(cards);
  return cards.map((c) => toRelativeFromMap(map, c));
}

