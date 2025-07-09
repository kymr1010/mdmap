use crate::{
    db::{fetch_all_card_rows, fetch_card_row_by_id, fetch_card_rows_in_range},
    models::{ApiResponse, Card, CardParams},
    schema::RangeParams,
};
use axum::{extract::Query, http::StatusCode, response::IntoResponse, Extension, Json};
use serde_json::json;
use sqlx::{MySql, Pool};

pub async fn get_cards(Extension(pool): Extension<Pool<sqlx::MySql>>) -> ApiResponse<Vec<Card>> {
    match fetch_all_card_rows(&pool).await {
        Ok(rows) => {
            let cards = rows.into_iter().map(Card::from).collect();
            ApiResponse::new_ok(StatusCode::OK, cards)
        }
        Err(e) => ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

pub async fn get_cards_in_range(
    Extension(pool): Extension<Pool<MySql>>,
    Query(params): Query<RangeParams>,
) -> ApiResponse<Vec<Card>> {
    // WKT ポリゴンを作成
    let poly = create_poly(params.min_x, params.min_y, params.max_x, params.max_y);

    match fetch_card_rows_in_range(&pool, &poly).await {
        Ok(rows) => {
            let cards = rows.into_iter().map(Card::from).collect();
            ApiResponse::new_ok(StatusCode::OK, cards)
        }
        Err(e) => ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

pub async fn create_card(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<CardParams>,
) -> ApiResponse<Card> {
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

    let res = match res {
        Ok(result) => result,
        Err(e) => {
            let _ = tx.rollback().await;
            return ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string());
        }
    };

    let card_id = res.last_insert_id() as i64;

    // if !params.tag_ids.is_empty() {
    //     for tag_id in &params.tag_ids {
    //         if let Err(e) = sqlx::query(
    //             r#"
    //             INSERT INTO card_tag (card_id, tag_id)
    //             VALUES (?, ?)
    //         "#,
    //         )
    //         .bind(card_id)
    //         .bind(tag_id)
    //         .execute(&mut *tx)
    //         .await
    //         {
    //             let _ = tx.rollback().await;
    //             return ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string());
    //         }
    //     }
    // };

    if let Err(e) = tx.commit().await {
        return ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string());
    }

    match fetch_card_row_by_id(&pool, card_id).await {
        Ok(row) => {
            let card = Card::from(row);
            ApiResponse::new_ok(StatusCode::OK, card)
        }
        Err(e) => ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

pub async fn update_card(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<CardParams>,
) -> ApiResponse<Card> {
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
        Ok(_) => match fetch_card_row_by_id(&pool, params.id).await {
            Ok(row) => {
                let card = Card::from(row);
                ApiResponse::new_ok(StatusCode::OK, card)
            }
            Err(e) => ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        },
        Err(e) => ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
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
