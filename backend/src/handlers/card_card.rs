use std::result;

use crate::models::{ApiResponse, CardCardRow, CardRelation};
use axum::{http::StatusCode, response::IntoResponse, Extension, Json};
use rand::rand_core::le;
use serde_json::json;
use sqlx::Pool;

pub async fn get_connectors(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
) -> ApiResponse<Vec<CardRelation>> {
    let rows = sqlx::query_as::<_, CardRelation>(
        r#"
      select c.card_parent_id, c.card_child_id, c.path
      from card_card c
    "#,
    )
    .fetch_all(&pool)
    .await;

    let rows = match rows {
        Ok(rows) => rows,
        Err(e) => {
            println!("get_connectors: {}", e);
            return ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string());
        }
    };

    let connectors: Vec<CardRelation> = rows
        .into_iter()
        .map(|r| CardRelation {
            card_parent_id: r.card_parent_id,
            card_child_id: r.card_child_id,
            path: r.path,
        })
        .collect();

    println!("get_connectors {:?}", connectors.len());

    ApiResponse::new_ok(StatusCode::OK, connectors)
}

pub async fn update_connector(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<CardCardRow>,
) -> ApiResponse<CardRelation> {
    let result = sqlx::query(
        r#"
            UPDATE card_card
            SET path = ?
            WHERE card_parent_id = ? AND card_child_id = ?
        "#,
    )
    .bind(&params.path)
    .bind(&params.card_parent_id)
    .bind(&params.card_child_id)
    .execute(&pool)
    .await;

    match result {
        Ok(result) => result,
        Err(e) => return ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };

    let record = sqlx::query_as::<_, CardRelation>(
        "SELECT card_parent_id, card_child_id, path FROM card_card WHERE card_parent_id = ? AND card_child_id = ?",
    )
    .bind(&params.card_parent_id)
    .bind(&params.card_child_id)
    .fetch_one(&pool)
    .await;

    let record = match record {
        Ok(record) => record,
        Err(e) => return ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };

    ApiResponse::new_ok(StatusCode::CREATED, record)
}

pub async fn connect_card_to_card(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<CardCardRow>,
) -> ApiResponse<CardRelation> {
    let result = sqlx::query(
        r#"
            INSERT INTO card_card (card_parent_id, card_child_id, path)
            VALUES (?, ?, ?)
        "#,
    )
    .bind(&params.card_parent_id)
    .bind(&params.card_child_id)
    .bind(&params.path)
    .execute(&pool)
    .await;

    println!("{:?}", result);

    let result = match result {
        Ok(result) => result,
        Err(e) => return ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };

    let last_id = result.last_insert_id() as i64;

    println!("{:?}", last_id);

    let record = sqlx::query_as::<_, CardRelation>(
        "SELECT card_parent_id, card_child_id, path FROM card_card WHERE card_parent_id = ? AND card_child_id = ?",
    )
    .bind(&params.card_parent_id)
    .bind(&params.card_child_id)
    .fetch_one(&pool)
    .await;

    let record = match record {
        Ok(record) => record,
        Err(e) => {
            println!("{:?}", e);
            return ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string());
        }
    };

    ApiResponse::new_ok(StatusCode::CREATED, record)
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
