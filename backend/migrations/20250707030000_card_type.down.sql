ALTER TABLE cards ADD COLUMN is_frame BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE cards SET is_frame = TRUE WHERE card_type = 'frame';
ALTER TABLE cards DROP COLUMN card_type;
