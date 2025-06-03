use crate::models::{Tag, TagRow};
use axum::{http::StatusCode, response::IntoResponse, Extension, Json};
use serde_json::json;
use sqlx::Pool;

pub async fn get_tags(Extension(pool): Extension<Pool<sqlx::MySql>>) -> Json<Vec<Tag>> {
    let rows = sqlx::query_as::<_, TagRow>(
        r#"
            SELECT id, name
            FROM tags
        "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let rows: Vec<Tag> = rows
        .into_iter()
        .map(|r| Tag {
            id: r.id,
            name: r.name,
        })
        .collect();

    Json(rows)
}

pub async fn create_tag(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<Tag>,
) -> impl IntoResponse {
    let result = sqlx::query(
        r#"
            INSERT INTO tags (name)
            VALUES (?)
        "#,
    )
    .bind(&params.name)
    .fetch_all(&pool)
    .await;

    match result {
        Ok(_) => (
            StatusCode::CREATED,
            Json(json!({"code": StatusCode::CREATED.to_string(), "message":"Success"})),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(
                json!({"code": StatusCode::INTERNAL_SERVER_ERROR.to_string(), "message":e.to_string()}),
            ),
        ),
    }
}

pub async fn update_tag(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<Tag>,
) -> impl IntoResponse {
    let result = sqlx::query(
        r#"
            UPDATE tags
            SET name = ?
            WHERE id = ?
        "#,
    )
    .bind(&params.name)
    .bind(&params.id)
    .fetch_all(&pool)
    .await;

    match result {
        Ok(_) => (
            StatusCode::ACCEPTED,
            Json(json!({"code": StatusCode::ACCEPTED.to_string(), "message":"Success"})),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(
                json!({"code": StatusCode::INTERNAL_SERVER_ERROR.to_string(), "message":e.to_string()}),
            ),
        ),
    }
}

pub async fn delete_tag(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<Tag>,
) -> impl IntoResponse {
    let result = sqlx::query(
        r#"
            DELETE FROM tags
            WHERE id = ?
        "#,
    )
    .bind(&params.id)
    .fetch_all(&pool)
    .await;

    match result {
        Ok(_) => (
            StatusCode::ACCEPTED,
            Json(json!({"code": StatusCode::ACCEPTED.to_string(), "message":"Success"})),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(
                json!({"code": StatusCode::INTERNAL_SERVER_ERROR.to_string(), "message":e.to_string()}),
            ),
        ),
    }
}
