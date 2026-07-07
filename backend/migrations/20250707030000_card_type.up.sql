-- Generalize the boolean `is_frame` flag into a `card_type` column so more
-- card types can be added in the future (currently 'normal' | 'frame').
ALTER TABLE cards ADD COLUMN card_type VARCHAR(32) NOT NULL DEFAULT 'normal';
UPDATE cards SET card_type = 'frame' WHERE is_frame = TRUE;
ALTER TABLE cards DROP COLUMN is_frame;
