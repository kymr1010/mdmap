CREATE TABLE card_card (
  card_parent_id  BIGINT NOT NULL,
  card_child_id   BIGINT NOT NULL,
  path JSON,
  PRIMARY KEY (card_parent_id, card_child_id),
  FOREIGN KEY (card_parent_id) REFERENCES cards(id),
  FOREIGN KEY (card_child_id) REFERENCES cards(id),
  CHECK (card_parent_id <> card_child_id)
);