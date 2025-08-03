export type Node = {
  position: Accessor<Dimmension>;
  cardId: Accessor<Card["id"]>;
  parentId: Accessor<Card["id"]>;
  realtimePosition: [Accessor<Dimmension>, Setter<Dimmension>];
  children: Node[];
  card: Accessor<Card>;
  setCard: (card: Partial<Card>) => void;
  connector?: Accessor<CardConnector>;
  setConnector?: (connector: Partial<CardConnector>) => void;
};

export type NodeMap = Map<Card["id"], Node>;
