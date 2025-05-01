-- Add up migration script here
CREATE TABLE cards (
  id       BIGINT AUTO_INCREMENT PRIMARY KEY,
  title    VARCHAR(100),
  contents TEXT,
  shape    POLYGON    NOT NULL,
  SPATIAL INDEX idx_shape (shape)
)
