use axum::{
    extract::Query,
    http::StatusCode,
    response::{IntoResponse, Response},
    Extension, Json,
};
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize, Serializer};
use serde_json::json;
use sqlx::{FromRow, MySql, Pool};

#[derive(Deserialize)]
pub struct FlashCardQuery {
    tag: String,
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
    Query(params): Query<FlashCardQuery>,
    Extension(pool): Extension<Pool<MySql>>,
) -> Response {
    match fetch_cards_by_tag(&pool, &params.tag).await {
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
    Json(result): Json<FlashCardResult>,
) -> Response {
    let updated_at = result
        .date
        .as_deref()
        .and_then(parse_flash_card_date);

    let update_result = update_flash_card_result(&pool, &params.tag, result, updated_at).await;

    match update_result {
        Ok(Some(card)) => Json(card).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({
                "code": StatusCode::NOT_FOUND.as_u16(),
                "message": "card not found for tag",
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

async fn fetch_cards_by_tag(pool: &Pool<MySql>, tag: &str) -> Result<Vec<FlashCard>, sqlx::Error> {
    sqlx::query_as::<_, FlashCard>(
        r#"
        SELECT DISTINCT c.id, c.title, c.contents, c.updated_at, c.ok_count
        FROM cards c
        INNER JOIN card_tag ct ON ct.card_id = c.id
        INNER JOIN tags t ON t.id = ct.tag_id
        WHERE t.name = ?
        ORDER BY c.id ASC
        "#,
    )
    .bind(tag)
    .fetch_all(pool)
    .await
}

async fn update_flash_card_result(
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
