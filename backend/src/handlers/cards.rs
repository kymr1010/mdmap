use crate::{
    models::{Card, CardRow},
    schema::{Dimmension, RangeParams},
};
use axum::{
    extract::Query,
    http::{Response, StatusCode},
    response::{ErrorResponse, IntoResponse},
    Extension, Json,
};
use serde_json::json;
use sqlx::Pool;

pub async fn get_cards_in_range(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Query(params): Query<RangeParams>,
) -> Json<Vec<Card>> {
    // クエリパラメータをもとに矩形ポリゴンを WKT で作成
    let poly = create_poly(params.min_x, params.min_y, params.max_x, params.max_y);

    println!("{}", poly);

    // MBRIntersects で当たり判定
    let rows = sqlx::query_as::<_, CardRow>(r#"
        SELECT
            ST_X(ST_PointN(ST_ExteriorRing(shape), 1))                             AS pos_x,
            ST_Y(ST_PointN(ST_ExteriorRing(shape), 1))                             AS pos_y,
            (ST_X(ST_PointN(ST_ExteriorRing(shape), 3)) - ST_X(ST_PointN(ST_ExteriorRing(shape), 1))) AS size_x,
            (ST_Y(ST_PointN(ST_ExteriorRing(shape), 3)) - ST_Y(ST_PointN(ST_ExteriorRing(shape), 1))) AS size_y,
            id, title, contents
        FROM cards
        WHERE MBRIntersects(shape, ST_GeomFromText(?))
    "#)
    .bind(&poly)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let cards: Vec<Card> = rows
        .into_iter()
        .map(|r| Card {
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
        })
        .collect();

    println!("Found {} cards in range.", cards[0].position.x);

    Json(cards)
}

pub async fn create_card(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<Card>,
) -> impl IntoResponse {
    let poly = create_poly(
        params.position.x,
        params.position.y,
        params.position.x + params.size.x,
        params.position.y + params.size.y,
    );

    let insert_result = sqlx::query(
        r#"
        INSERT INTO cards (shape, title, contents)
        VALUES (ST_GeomFromText(?), ?, ?)
    "#,
    )
    .bind(&poly)
    .bind(&params.title)
    .bind(&params.contents)
    .fetch_all(&pool)
    .await;

    match insert_result {
        Ok(exec_res) => (
            StatusCode::CREATED,
            Json(json!({"code": StatusCode::CREATED.to_string(), "message":""})),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(
                json!({"code": StatusCode::INTERNAL_SERVER_ERROR.to_string(), "message": e.to_string()}),
            ),
        ),
    }
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

    let res = sqlx::query(
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

    match res {
        Ok(exec_res) => (
            StatusCode::ACCEPTED,
            Json(json!({"code": StatusCode::ACCEPTED.to_string(), "message":""})),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(
                json!({"code": StatusCode::INTERNAL_SERVER_ERROR.to_string(), "message": e.to_string()}),
            ),
        ),
    }
}

fn create_poly(minX: f64, minY: f64, maxX: f64, maxY: f64) -> String {
    format!(
        "POLYGON((\
        {minX} {minY}, {maxX} {minY}, \
        {maxX} {maxY}, {minX} {maxY}, \
        {minX} {minY} \
      ))",
        minX = minX,
        minY = minY,
        maxX = maxX,
        maxY = maxY,
    )
}
