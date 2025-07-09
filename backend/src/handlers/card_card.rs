use crate::models::{ApiResponse, CardCardParams, CardRelation};
use axum::{http::StatusCode, response::IntoResponse, Extension, Json};
use serde_json::json;
use sqlx::{MySql, Pool};

pub async fn get_connectors(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
) -> ApiResponse<Vec<CardRelation>> {
    let rows = sqlx::query_as::<_, CardRelation>(
        r#"
      select c.card_parent_id, c.card_child_id, c.connector, c.created_at, c.updated_at
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
            connector: r.connector,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
        .collect();

    println!("get_connectors {:?}", connectors.len());

    ApiResponse::new_ok(StatusCode::OK, connectors)
}

pub async fn update_connector(
    Extension(pool): Extension<Pool<sqlx::MySql>>,
    Json(params): Json<CardCardParams>,
) -> ApiResponse<CardRelation> {
    if let Ok(true) = has_cycle(&pool, params.card_parent_id, params.card_child_id).await {
        return ApiResponse::new_err(
            StatusCode::BAD_REQUEST,
            "Cannot update: it would create a cycle",
        );
    }

    let result = sqlx::query(
        r#"
            UPDATE card_card
            SET connector = ?
            WHERE card_parent_id = ? AND card_child_id = ?
        "#,
    )
    .bind(&params.connector)
    .bind(&params.card_parent_id)
    .bind(&params.card_child_id)
    .execute(&pool)
    .await;

    match result {
        Ok(result) => result,
        Err(e) => return ApiResponse::new_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };

    let record = sqlx::query_as::<_, CardRelation>(
        "SELECT card_parent_id, card_child_id, connector FROM card_card WHERE card_parent_id = ? AND card_child_id = ?",
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
    Json(params): Json<CardCardParams>,
) -> ApiResponse<CardRelation> {
    match has_cycle(&pool, params.card_parent_id, params.card_child_id).await {
        Ok(true) => {
            return ApiResponse::new_err(
                StatusCode::BAD_REQUEST,
                "Cannot connect: it would create a cycle",
            );
        }
        Err(e) => {
            return ApiResponse::new_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("cycle check failed: {}", e),
            );
        }
        _ => {}
    }

    let result = sqlx::query(
        r#"
            INSERT INTO card_card (card_parent_id, card_child_id, connector)
            VALUES (?, ?, ?)
        "#,
    )
    .bind(&params.card_parent_id)
    .bind(&params.card_child_id)
    .bind(&params.connector)
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
        "SELECT card_parent_id, card_child_id, connector, created_at, updated_at FROM card_card WHERE card_parent_id = ? AND card_child_id = ?",
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
    Json(params): Json<CardCardParams>,
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

pub async fn has_cycle(
    pool: &Pool<MySql>,
    parent_id: i64,
    child_id: i64,
) -> Result<bool, sqlx::Error> {
    let sql = r#"
        WITH RECURSIVE descendants AS (
          -- stage1: child_id の直下の子
          SELECT card_child_id AS descendant
            FROM card_card
           WHERE card_parent_id = ?
          UNION ALL
          -- stageN: 既に見つかった descendant を親として更に下を掘る
          SELECT c.card_child_id
            FROM card_card c
            JOIN descendants d ON c.card_parent_id = d.descendant
        )
        -- 最後に parent_id が descendants 内にあれば循環
        SELECT descendant
          FROM descendants
         WHERE descendant = ?
         LIMIT 1
        "#;

    let found: Option<i64> = sqlx::query_scalar(sql)
        .bind(child_id)
        .bind(parent_id)
        .fetch_optional(pool)
        .await?;

    Ok(found.is_some())
}
