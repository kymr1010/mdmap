-- Add publication scope (visibility) to cards.
-- 'public'  : visible to everyone
-- 'private' : visible only to authenticated (admin) users
ALTER TABLE cards
  ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'public';
