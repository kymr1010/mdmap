import type { Card } from "../schema/Card.js";
import type { CardRelation } from "../schema/CardRelation.js";
import type { Dimmension } from "../schema/Point.js";
import type { CardConnector } from "../schema/Connrctor.js";
import { Accessor, createMemo, createSignal, Setter } from "solid-js";
import { Node, NodeMap } from "../schema/CardNode.js";

export function useNodeTree(
  cards: Accessor<Card[]>,
  setCards: Setter<Card[]>,
  relations: Accessor<CardRelation[]>,
  setRelations: Setter<CardRelation[]>
): {
  nodeTree: Accessor<Node[]>;
  nodeMap: Accessor<NodeMap>;
} {
  // options の用意
  const options: BuildTreeOptions = {
    onSetCard: (updated) => {
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    },
    onSetConnector: (childId, newConn) => {
      setRelations((prev) =>
        prev.map((r) =>
          r.child_id === childId ? { ...r, connector: newConn } : r
        )
      );
    },
  };

  const tree = createMemo(() =>
    buildTree(cards, setCards, relations, setRelations)
  );

  return {
    nodeTree: () => tree().nodes,
    nodeMap: () => tree().nodeMap,
  };
}

export interface BuildTreeOptions {
  onSetCard: (updated: Card) => void;
  onSetConnector: (childId: number, newConn: CardConnector) => void;
}

export function buildTree(
  cards: Accessor<Card[]>,
  setCards: Setter<Card[]>,
  relations: Accessor<CardRelation[]>,
  setCardRelations: Setter<CardRelation[]>
): { nodes: Node[]; nodeMap: NodeMap } {
  const nodeMap = new Map<Card["id"], Node>();

  // 1) Map を作成
  cards().forEach((card) => {
    const connector = relations().find(
      (r) => r.child_id === card.id
    )?.connector;

    nodeMap.set(card.id, {
      cardId: () => card.id,
      parentId: () => card.parent_id ?? null,
      card: () => cards().find((c) => c.id === card.id)!,
      // カード更新時は onSetCard を呼び出し
      setCard: (card: Partial<Card>) => {
        setCards((prev) =>
          prev.map((c) => (c.id === card.id ? { ...c, ...card } : c))
        );
      },
      realtimePosition: createSignal<Dimmension>(card.position),
      connector: connector ? () => connector : undefined,
      // コネクタ更新時は onSetConnector(childId, newConn)
      setConnector: connector
        ? (connector: Partial<CardConnector>) =>
            setCardRelations((prev) =>
              prev.map((c) =>
                c.child_id === card.id ? { ...c, ...connector } : c
              )
            )
        : undefined,
      children: [] as Node[],
      position: () => ({ x: 0, y: 0 }),
    });
  });

  // 2) 親子リンクを張って nodes を集め
  const nodes: Node[] = [];
  nodeMap.forEach((node) => {
    const pid = node.card().parent_id;
    if (pid == null || !nodeMap.has(pid)) {
      nodes.push(node);
    } else {
      nodeMap.get(pid)!.children.push(node);
    }
  });

  // 3) 位置を再帰的に annotate
  const annotate = (node: Node, parentAbs: Dimmension) => {
    const abs = {
      x: parentAbs.x + node.card().position.x,
      y: parentAbs.y + node.card().position.y,
    };
    node.position = () => abs;
    node.realtimePosition[1](abs);
    node.children.forEach((c) => annotate(c, abs));
  };
  nodes.forEach((r) => annotate(r, { x: 0, y: 0 }));

  return { nodes, nodeMap };
}
