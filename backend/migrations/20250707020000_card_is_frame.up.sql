-- Frame flag: when true, the card is rendered as a large rectangular frame
-- (領域) and cards created inside its area are auto-registered as its children.
ALTER TABLE cards
  ADD COLUMN is_frame BOOLEAN NOT NULL DEFAULT FALSE;
