CREATE TABLE card_tag (
  card_id  BIGINT NOT NULL,
  tag_id   BIGINT NOT NULL,
  PRIMARY KEY (card_id, tag_id),
  FOREIGN KEY (card_id) REFERENCES cards (id),
  FOREIGN KEY (tag_id) REFERENCES tags (id)
)