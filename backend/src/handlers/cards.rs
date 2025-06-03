use crate::{
    models::{Card, CardRow},
    schema::{Dimmension, RangeParams},
};
use axum::{extract::Query, http::StatusCode, response::IntoResponse, Extension, Json};
use serde_json::json;
use sqlx::{Executor, MySql, Pool, Transaction};

pub async fn get_cards_in_range(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Query(params): Query<RangeParams>,
) -> Json<Vec<Card>> {
    // クエリパラメータをもとに矩形ポリゴンを WKT で作成
    let poly = create_poly(params.min_x, params.min_y, params.max_x, params.max_y);

    println!("{}", poly);

    // MBRIntersects で当たり判定
    let rows = match sqlx::query_as::<_, CardRow>(r#"
            SELECT
                ST_X(ST_PointN(ST_ExteriorRing(shape), 1))                             AS pos_x,
                ST_Y(ST_PointN(ST_ExteriorRing(shape), 1))                             AS pos_y,
                (ST_X(ST_PointN(ST_ExteriorRing(shape), 3)) - ST_X(ST_PointN(ST_ExteriorRing(shape), 1))) AS size_x,
                (ST_Y(ST_PointN(ST_ExteriorRing(shape), 3)) - ST_Y(ST_PointN(ST_ExteriorRing(shape), 1))) AS size_y,
                c.id, c.title, c.contents,
                COALESCE(
                    JSON_ARRAYAGG(
                        JSON_OBJECT('id', ct.tag_id)
                    )
                , JSON_ARRAY())                                                        AS tag_ids,
                COALESCE(
                    JSON_ARRAYAGG(
                        JSON_OBJECT('id', cc.card_child_id)
                    )
                , JSON_ARRAY())                                                        AS card_ids
            FROM cards as c
            LEFT JOIN card_tag AS ct ON ct.card_id = c.id
            LEFT JOIN card_card AS cc ON cc.card_parent_id = c.id
            WHERE MBRIntersects(shape, ST_GeomFromText(?))
            GROUP BY c.id, c.title, c.contents, pos_x, pos_y, size_x, size_y;
        "#)
        .bind(&poly)
        .fetch_all(&pool)
        .await {
            Ok(n) => {n},
            Err(e) => {println!("{}", e); Vec::new()},
        };

    let cards: Vec<Card> = rows
        .into_iter()
        .map(|r| {
            let tag_ids: Vec<i64> = serde_json::from_value(r.tag_ids).unwrap_or_default();
            let card_ids: Vec<i64> = serde_json::from_value(r.card_ids).unwrap_or_default();
            Card {
                id: r.id,
                position: Dimmension {
                    x: r.pos_x,
                    y: r.pos_y,
                },
                size: Dimmension {
                    x: r.size_x,
                    y: r.size_y,
                },
                title: r.title,
                contents: r.contents,
                tag_ids,
                card_ids,
            }
        })
        .collect();

    println!("Found {} cards in range.", cards.len());

    Json(cards)
}

pub async fn create_card(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<Card>,
) -> impl IntoResponse {
    let mut tx = pool.begin().await.expect("transaction error.");

    let poly = create_poly(
        params.position.x,
        params.position.y,
        params.position.x + params.size.x,
        params.position.y + params.size.y,
    );

    let res = sqlx::query(
        r#"
        INSERT INTO cards (shape, title, contents)
        VALUES (ST_GeomFromText(?), ?, ?)
    "#,
    )
    .bind(&poly)
    .bind(&params.title)
    .bind(&params.contents)
    .execute(&mut *tx)
    .await;

    let card_id = match res {
        Ok(result) => result.last_insert_id() as i64,
        Err(e) => {
            let _ = tx.rollback().await;
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"message": e.to_string()})),
            );
        }
    };

    if !params.tag_ids.is_empty() {
        for tag_id in &params.tag_ids {
            if let Err(e) = sqlx::query(
                r#"
                INSERT INTO card_tag (card_id, tag_id)
                VALUES (?, ?)
            "#,
            )
            .bind(card_id)
            .bind(tag_id)
            .execute(&mut *tx)
            .await
            {
                let _ = tx.rollback().await;
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"message": e.to_string()})),
                );
            }
        }
    };

    if let Err(e) = tx.commit().await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"message": format!("Failed to commit transaction: {}", e)})),
        );
    }

    (
        StatusCode::CREATED,
        Json(json!({"message":"Success", "card_id": card_id})),
    )
}

pub async fn update_card(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<Card>,
) -> impl IntoResponse {
    let poly = create_poly(
        params.position.x,
        params.position.y,
        params.position.x + params.size.x,
        params.position.y + params.size.y,
    );

    let result = sqlx::query(
        r#"
        UPDATE cards 
        SET shape = ST_GeomFromText(?), title = ?, contents = ?
        WHERE id = ?
    "#,
    )
    .bind(&poly)
    .bind(&params.title)
    .bind(&params.contents)
    .bind(&params.id)
    .execute(&pool)
    .await;

    match result {
        Ok(_) => (
            StatusCode::ACCEPTED,
            Json(json!({"code": StatusCode::ACCEPTED.to_string(), "message":"Success"})),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(
                json!({"code": StatusCode::INTERNAL_SERVER_ERROR.to_string(), "message": e.to_string()}),
            ),
        ),
    }
}

pub async fn delete_card(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<Card>,
) -> impl IntoResponse {
    let res = sqlx::query(
        r#"
        DELETE FROM cards 
        WHERE id = ?
    "#,
    )
    .bind(&params.id)
    .execute(&pool)
    .await;

    match res {
        Ok(_) => (
            StatusCode::ACCEPTED,
            Json(json!({"code": StatusCode::ACCEPTED.to_string(), "message":"Success"})),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(
                json!({"code": StatusCode::INTERNAL_SERVER_ERROR.to_string(), "message": e.to_string()}),
            ),
        ),
    }
}

fn create_poly(min_x: f64, min_y: f64, max_x: f64, max_y: f64) -> String {
    format!(
        "POLYGON((\
        {min_x} {min_y}, {max_x} {min_y}, \
        {max_x} {max_y}, {min_x} {max_y}, \
        {min_x} {min_y} \
      ))",
        min_x = min_x,
        min_y = min_y,
        max_x = max_x,
        max_y = max_y,
    )
}
