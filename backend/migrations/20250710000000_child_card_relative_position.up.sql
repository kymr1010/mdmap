UPDATE cards c
JOIN (
  SELECT
    child.id AS child_id,
    ST_X(ST_PointN(ST_ExteriorRing(child.shape), 1)) AS child_x,
    ST_Y(ST_PointN(ST_ExteriorRing(child.shape), 1)) AS child_y,
    ST_X(ST_PointN(ST_ExteriorRing(parent.shape), 1)) AS parent_x,
    ST_Y(ST_PointN(ST_ExteriorRing(parent.shape), 1)) AS parent_y,
    ST_X(ST_PointN(ST_ExteriorRing(child.shape), 3)) - ST_X(ST_PointN(ST_ExteriorRing(child.shape), 1)) AS width,
    ST_Y(ST_PointN(ST_ExteriorRing(child.shape), 3)) - ST_Y(ST_PointN(ST_ExteriorRing(child.shape), 1)) AS height
  FROM cards child
  INNER JOIN (
    SELECT card_child_id, MIN(card_parent_id) AS card_parent_id
    FROM card_card
    GROUP BY card_child_id
  ) rel ON rel.card_child_id = child.id
  INNER JOIN cards parent ON parent.id = rel.card_parent_id
) pos ON pos.child_id = c.id
SET c.shape = ST_GeomFromText(CONCAT(
  'POLYGON((',
  pos.child_x - pos.parent_x, ' ', pos.child_y - pos.parent_y, ', ',
  pos.child_x - pos.parent_x + pos.width, ' ', pos.child_y - pos.parent_y, ', ',
  pos.child_x - pos.parent_x + pos.width, ' ', pos.child_y - pos.parent_y + pos.height, ', ',
  pos.child_x - pos.parent_x, ' ', pos.child_y - pos.parent_y + pos.height, ', ',
  pos.child_x - pos.parent_x, ' ', pos.child_y - pos.parent_y,
  '))'
));
