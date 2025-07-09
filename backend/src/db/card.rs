use crate::models::CardRow;
use sqlx::{Executor, MySql};

// SELECT の共通部分
const SELECT_CARD_ROWS: &str = r#"
SELECT
    ST_X(ST_PointN(ST_ExteriorRing(shape), 1)) AS pos_x,
    ST_Y(ST_PointN(ST_ExteriorRing(shape), 1)) AS pos_y,
    (ST_X(ST_PointN(ST_ExteriorRing(shape), 3)) - ST_X(ST_PointN(ST_ExteriorRing(shape), 1))) AS size_x,
    (ST_Y(ST_PointN(ST_ExteriorRing(shape), 3)) - ST_Y(ST_PointN(ST_ExteriorRing(shape), 1))) AS size_y,
    c.id, c.title, c.contents, c.created_at, c.updated_at, cc.card_parent_id AS parent_id,
    COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id', ct.tag_id)), JSON_ARRAY()) AS tag_ids,
    COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id', cc.card_child_id)), JSON_ARRAY()) AS card_ids
FROM cards c
LEFT JOIN card_tag AS ct ON ct.card_id = c.id
LEFT JOIN card_card AS cc ON cc.card_child_id = c.id
"#;

// 全件取得
pub async fn fetch_all_card_rows<'e, E>(executor: E) -> Result<Vec<CardRow>, sqlx::Error>
where
    E: Executor<'e, Database = MySql>,
{
    sqlx::query_as::<_, CardRow>(SELECT_CARD_ROWS)
        .fetch_all(executor)
        .await
}

// 範囲クエリ（MBRIntersects + GROUP BY）
pub async fn fetch_card_rows_in_range<'e, E>(
    executor: E,
    wkt_poly: &str,
) -> Result<Vec<CardRow>, sqlx::Error>
where
    E: Executor<'e, Database = MySql>,
{
    let sql = format!(
        "{} WHERE MBRIntersects(shape, ST_GeomFromText(?)) \
         GROUP BY c.id, c.title, c.contents,c.created_at, c.updated_at, pos_x, pos_y, size_x, size_y",
        SELECT_CARD_ROWS
    );
    sqlx::query_as::<_, CardRow>(&sql)
        .bind(wkt_poly)
        .fetch_all(executor)
        .await
}

// ID 指定で１件取得
pub async fn fetch_card_row_by_id<'e, E>(executor: E, card_id: i64) -> Result<CardRow, sqlx::Error>
where
    E: Executor<'e, Database = MySql>,
{
    let sql = format!("{} WHERE c.id = ?", SELECT_CARD_ROWS);
    sqlx::query_as::<_, CardRow>(&sql)
        .bind(card_id)
        .fetch_one(executor)
        .await
}
