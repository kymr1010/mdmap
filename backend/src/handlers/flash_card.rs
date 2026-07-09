use axum::{
    body::Bytes,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Extension, Json,
};
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize, Serializer};
use serde_json::json;
use sqlx::{FromRow, MySql, Pool};

use crate::auth::AuthState;

#[derive(Deserialize)]
pub struct FlashCardQuery {
    tag: Option<String>,
    parent_id: Option<i64>,
}

#[derive(FromRow, Serialize)]
pub struct FlashCard {
    id: i64,
    title: String,
    contents: String,
    #[serde(rename = "date", serialize_with = "serialize_naive_datetime_as_utc")]
    updated_at: NaiveDateTime,
    ok_count: i32,
}

#[derive(Deserialize)]
pub struct FlashCardResult {
    id: i64,
    #[serde(rename = "is_OK")]
    is_ok: bool,
    date: Option<String>,
    contents: Option<String>,
    title: Option<String>,
}

pub async fn get_flash_cards_by_tag(
    State(auth): State<AuthState>,
    Query(params): Query<FlashCardQuery>,
    headers: HeaderMap,
    Extension(pool): Extension<Pool<MySql>>,
) -> Response {
    let include_private = auth.api_key_user(&pool, &headers).await.is_some();

    let result = match (&params.tag, params.parent_id) {
        (Some(tag), Some(parent_id)) => {
            fetch_child_cards_by_parent_and_tag(&pool, parent_id, tag, include_private).await
        }
        (Some(tag), None) => fetch_cards_by_tag(&pool, tag, include_private).await,
        (None, Some(parent_id)) => {
            fetch_child_cards_by_parent(&pool, parent_id, include_private).await
        }
        (None, None) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "code": StatusCode::BAD_REQUEST.as_u16(),
                    "message": "tag or parent_id is required",
                })),
            )
                .into_response();
        }
    };

    match result {
        Ok(cards) => Json(cards).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "code": StatusCode::INTERNAL_SERVER_ERROR.as_u16(),
                "message": e.to_string(),
            })),
        )
            .into_response(),
    }
}

pub async fn post_flash_card_result(
    Query(params): Query<FlashCardQuery>,
    Extension(pool): Extension<Pool<MySql>>,
    body: Bytes,
) -> Response {
    let result = match serde_json::from_slice::<FlashCardResult>(&body) {
        Ok(result) => result,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "code": StatusCode::BAD_REQUEST.as_u16(),
                    "message": e.to_string(),
                })),
            )
                .into_response();
        }
    };

    let updated_at = result
        .date
        .as_deref()
        .and_then(parse_flash_card_date);

    let update_result = match (&params.tag, params.parent_id) {
        (Some(tag), Some(parent_id)) => {
            update_flash_card_result_by_parent_and_tag(&pool, parent_id, tag, result, updated_at)
                .await
        }
        (Some(tag), None) => update_flash_card_result_by_tag(&pool, tag, result, updated_at).await,
        (None, Some(parent_id)) => {
            update_flash_card_result_by_parent(&pool, parent_id, result, updated_at).await
        }
        (None, None) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "code": StatusCode::BAD_REQUEST.as_u16(),
                    "message": "tag or parent_id is required",
                })),
            )
                .into_response();
        }
    };

    match update_result {
        Ok(Some(card)) => Json(card).into_response(),
        Ok(None) => (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "code": StatusCode::NOT_FOUND.as_u16(),
                    "message": "card not found for query",
                })),
            )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "code": StatusCode::INTERNAL_SERVER_ERROR.as_u16(),
                "message": e.to_string(),
            })),
        )
            .into_response(),
    }
}

async fn fetch_cards_by_tag(
    pool: &Pool<MySql>,
    tag: &str,
    include_private: bool,
) -> Result<Vec<FlashCard>, sqlx::Error> {
    sqlx::query_as::<_, FlashCard>(
        r#"
        SELECT DISTINCT c.id, c.title, c.contents, c.updated_at, c.ok_count
        FROM cards c
        INNER JOIN card_tag ct ON ct.card_id = c.id
        INNER JOIN tags t ON t.id = ct.tag_id
        WHERE t.name = ? AND (? OR c.visibility <> 'private')
        ORDER BY c.id ASC
        "#,
    )
    .bind(tag)
    .bind(include_private)
    .fetch_all(pool)
    .await
}

async fn fetch_child_cards_by_parent(
    pool: &Pool<MySql>,
    parent_id: i64,
    include_private: bool,
) -> Result<Vec<FlashCard>, sqlx::Error> {
    sqlx::query_as::<_, FlashCard>(
        r#"
        SELECT c.id, c.title, c.contents, c.updated_at, c.ok_count
        FROM cards c
        INNER JOIN card_card cc ON cc.card_child_id = c.id
        WHERE cc.card_parent_id = ? AND (? OR c.visibility <> 'private')
        ORDER BY c.id ASC
        "#,
    )
    .bind(parent_id)
    .bind(include_private)
    .fetch_all(pool)
    .await
}

async fn fetch_child_cards_by_parent_and_tag(
    pool: &Pool<MySql>,
    parent_id: i64,
    tag: &str,
    include_private: bool,
) -> Result<Vec<FlashCard>, sqlx::Error> {
    sqlx::query_as::<_, FlashCard>(
        r#"
        SELECT DISTINCT c.id, c.title, c.contents, c.updated_at, c.ok_count
        FROM cards c
        INNER JOIN card_card cc ON cc.card_child_id = c.id
        INNER JOIN card_tag ct ON ct.card_id = c.id
        INNER JOIN tags t ON t.id = ct.tag_id
        WHERE cc.card_parent_id = ? AND t.name = ? AND (? OR c.visibility <> 'private')
        ORDER BY c.id ASC
        "#,
    )
    .bind(parent_id)
    .bind(tag)
    .bind(include_private)
    .fetch_all(pool)
    .await
}

async fn update_flash_card_result_by_tag(
    pool: &Pool<MySql>,
    tag: &str,
    result: FlashCardResult,
    updated_at: Option<NaiveDateTime>,
) -> Result<Option<FlashCard>, sqlx::Error> {
    let affected = if let Some(updated_at) = updated_at {
        sqlx::query(
            r#"
            UPDATE cards c
            INNER JOIN card_tag ct ON ct.card_id = c.id
            INNER JOIN tags t ON t.id = ct.tag_id
            SET
              c.ok_count = c.ok_count + ?,
              c.contents = COALESCE(?, c.contents),
              c.title = COALESCE(?, c.title),
              c.updated_at = ?
            WHERE c.id = ? AND t.name = ?
            "#,
        )
        .bind(if result.is_ok { 1 } else { 0 })
        .bind(result.contents.as_deref())
        .bind(result.title.as_deref())
        .bind(updated_at)
        .bind(result.id)
        .bind(tag)
        .execute(pool)
        .await?
        .rows_affected()
    } else {
        sqlx::query(
            r#"
            UPDATE cards c
            INNER JOIN card_tag ct ON ct.card_id = c.id
            INNER JOIN tags t ON t.id = ct.tag_id
            SET
              c.ok_count = c.ok_count + ?,
              c.contents = COALESCE(?, c.contents),
              c.title = COALESCE(?, c.title)
            WHERE c.id = ? AND t.name = ?
            "#,
        )
        .bind(if result.is_ok { 1 } else { 0 })
        .bind(result.contents.as_deref())
        .bind(result.title.as_deref())
        .bind(result.id)
        .bind(tag)
        .execute(pool)
        .await?
        .rows_affected()
    };

    if affected == 0 {
        return Ok(None);
    }

    let card = sqlx::query_as::<_, FlashCard>(
        r#"
        SELECT c.id, c.title, c.contents, c.updated_at, c.ok_count
        FROM cards c
        INNER JOIN card_tag ct ON ct.card_id = c.id
        INNER JOIN tags t ON t.id = ct.tag_id
        WHERE c.id = ? AND t.name = ?
        LIMIT 1
        "#,
    )
    .bind(result.id)
    .bind(tag)
    .fetch_one(pool)
    .await?;

    Ok(Some(card))
}

async fn update_flash_card_result_by_parent(
    pool: &Pool<MySql>,
    parent_id: i64,
    result: FlashCardResult,
    updated_at: Option<NaiveDateTime>,
) -> Result<Option<FlashCard>, sqlx::Error> {
    let affected = if let Some(updated_at) = updated_at {
        sqlx::query(
            r#"
            UPDATE cards c
            INNER JOIN card_card cc ON cc.card_child_id = c.id
            SET
              c.ok_count = c.ok_count + ?,
              c.contents = COALESCE(?, c.contents),
              c.title = COALESCE(?, c.title),
              c.updated_at = ?
            WHERE c.id = ? AND cc.card_parent_id = ?
            "#,
        )
        .bind(if result.is_ok { 1 } else { 0 })
        .bind(result.contents.as_deref())
        .bind(result.title.as_deref())
        .bind(updated_at)
        .bind(result.id)
        .bind(parent_id)
        .execute(pool)
        .await?
        .rows_affected()
    } else {
        sqlx::query(
            r#"
            UPDATE cards c
            INNER JOIN card_card cc ON cc.card_child_id = c.id
            SET
              c.ok_count = c.ok_count + ?,
              c.contents = COALESCE(?, c.contents),
              c.title = COALESCE(?, c.title)
            WHERE c.id = ? AND cc.card_parent_id = ?
            "#,
        )
        .bind(if result.is_ok { 1 } else { 0 })
        .bind(result.contents.as_deref())
        .bind(result.title.as_deref())
        .bind(result.id)
        .bind(parent_id)
        .execute(pool)
        .await?
        .rows_affected()
    };

    if affected == 0 {
        return Ok(None);
    }

    let card = sqlx::query_as::<_, FlashCard>(
        r#"
        SELECT c.id, c.title, c.contents, c.updated_at, c.ok_count
        FROM cards c
        INNER JOIN card_card cc ON cc.card_child_id = c.id
        WHERE c.id = ? AND cc.card_parent_id = ?
        LIMIT 1
        "#,
    )
    .bind(result.id)
    .bind(parent_id)
    .fetch_one(pool)
    .await?;

    Ok(Some(card))
}

async fn update_flash_card_result_by_parent_and_tag(
    pool: &Pool<MySql>,
    parent_id: i64,
    tag: &str,
    result: FlashCardResult,
    updated_at: Option<NaiveDateTime>,
) -> Result<Option<FlashCard>, sqlx::Error> {
    let affected = if let Some(updated_at) = updated_at {
        sqlx::query(
            r#"
            UPDATE cards c
            INNER JOIN card_card cc ON cc.card_child_id = c.id
            INNER JOIN card_tag ct ON ct.card_id = c.id
            INNER JOIN tags t ON t.id = ct.tag_id
            SET
              c.ok_count = c.ok_count + ?,
              c.contents = COALESCE(?, c.contents),
              c.title = COALESCE(?, c.title),
              c.updated_at = ?
            WHERE c.id = ? AND cc.card_parent_id = ? AND t.name = ?
            "#,
        )
        .bind(if result.is_ok { 1 } else { 0 })
        .bind(result.contents.as_deref())
        .bind(result.title.as_deref())
        .bind(updated_at)
        .bind(result.id)
        .bind(parent_id)
        .bind(tag)
        .execute(pool)
        .await?
        .rows_affected()
    } else {
        sqlx::query(
            r#"
            UPDATE cards c
            INNER JOIN card_card cc ON cc.card_child_id = c.id
            INNER JOIN card_tag ct ON ct.card_id = c.id
            INNER JOIN tags t ON t.id = ct.tag_id
            SET
              c.ok_count = c.ok_count + ?,
              c.contents = COALESCE(?, c.contents),
              c.title = COALESCE(?, c.title)
            WHERE c.id = ? AND cc.card_parent_id = ? AND t.name = ?
            "#,
        )
        .bind(if result.is_ok { 1 } else { 0 })
        .bind(result.contents.as_deref())
        .bind(result.title.as_deref())
        .bind(result.id)
        .bind(parent_id)
        .bind(tag)
        .execute(pool)
        .await?
        .rows_affected()
    };

    if affected == 0 {
        return Ok(None);
    }

    let card = sqlx::query_as::<_, FlashCard>(
        r#"
        SELECT c.id, c.title, c.contents, c.updated_at, c.ok_count
        FROM cards c
        INNER JOIN card_card cc ON cc.card_child_id = c.id
        INNER JOIN card_tag ct ON ct.card_id = c.id
        INNER JOIN tags t ON t.id = ct.tag_id
        WHERE c.id = ? AND cc.card_parent_id = ? AND t.name = ?
        LIMIT 1
        "#,
    )
    .bind(result.id)
    .bind(parent_id)
    .bind(tag)
    .fetch_one(pool)
    .await?;

    Ok(Some(card))
}

fn parse_flash_card_date(value: &str) -> Option<NaiveDateTime> {
    DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.with_timezone(&Utc).naive_utc())
        .ok()
}

fn serialize_naive_datetime_as_utc<S>(
    value: &NaiveDateTime,
    serializer: S,
) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&format!("{}Z", value.format("%Y-%m-%dT%H:%M:%S")))
}
