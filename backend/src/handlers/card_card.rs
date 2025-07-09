use crate::models::CardCardRow;
use axum::{http::StatusCode, response::IntoResponse, Extension, Json};
use serde_json::json;
use sqlx::Pool;

pub async fn get_connectors(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
) -> Json<Vec<CardCardRow>> {
    let rows = sqlx::query_as::<_, CardCardRow>(
        r#"
      SELECT card_parent_id, card_child_id, id, path
      FROM card_card
    "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
}

pub async fn connect_card_to_card(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<CardCardRow>,
) -> impl IntoResponse {
    let result = sqlx::query(
        r#"
            INSERT INTO card_card (card_parent_id, card_child_id)
            VALUES (?, ?)
        "#,
    )
    .bind(&params.card_parent_id)
    .bind(&params.card_child_id)
    .fetch_all(&pool)
    .await;

    println!("{:?}", result);
    match result {
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(
                json!({"code": StatusCode::INTERNAL_SERVER_ERROR.to_string(), "message":e.to_string()}),
            ),
        ),
        Ok(_) => (
            StatusCode::CREATED,
            Json(json!({"code": StatusCode::CREATED.to_string(), "message":"Success"})),
        ),
    }
}

pub async fn disconnect_card_to_card(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<CardCardRow>,
) -> impl IntoResponse {
    let result = sqlx::query(
        r#"
            DELETE FROM card_card
            WHERE card_parent_id = ? AND card_child_id = ?
        "#,
    )
    .bind(&params.card_parent_id)
    .bind(&params.card_child_id)
    .fetch_all(&pool)
    .await;

    match result {
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(
                json!({"code": StatusCode::INTERNAL_SERVER_ERROR.to_string(), "message":e.to_string()}),
            ),
        ),
        Ok(_) => (
            StatusCode::ACCEPTED,
            Json(json!({"code": StatusCode::ACCEPTED.to_string(), "message":"Success"})),
        ),
    }
}
