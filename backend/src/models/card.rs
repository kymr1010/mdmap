use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::schema::Dimmension;

fn default_visibility() -> String {
    "public".to_string()
}

fn default_card_type() -> String {
    "normal".to_string()
}

#[derive(Serialize, Deserialize)]
pub struct Card {
    pub id: i64,
    pub position: Dimmension,
    pub size: Dimmension,
    pub title: String,
    pub contents: String,
    pub parent_id: Option<i64>,
    pub tag_ids: Vec<i64>,
    #[serde(default = "default_visibility")]
    pub visibility: String,
    #[serde(default = "default_card_type")]
    pub card_type: String,
    pub ok_count: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Serialize, Deserialize)]
pub struct CardParams {
    pub id: i64,
    pub position: Dimmension,
    pub size: Dimmension,
    pub title: String,
    pub contents: String,
    pub parent_id: Option<i64>,
    pub tag_ids: Vec<i64>,
    #[serde(default = "default_visibility")]
    pub visibility: String,
    #[serde(default = "default_card_type")]
    pub card_type: String,
}

#[derive(FromRow)]
pub struct CardRow {
    pub id: i64,
    pub pos_x: f64,
    pub pos_y: f64,
    pub size_x: f64,
    pub size_y: f64,
    pub title: String,
    pub contents: String,
    pub parent_id: Option<i64>,
    pub tag_ids: serde_json::Value,
    pub visibility: String,
    pub card_type: String,
    pub ok_count: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<CardRow> for Card {
    fn from(r: CardRow) -> Self {
        let tag_ids: Vec<i64> = serde_json::from_value(r.tag_ids).unwrap_or_default();
        Card {
            id: r.id,
            title: r.title,
            contents: r.contents,
            position: Dimmension {
                x: r.pos_x,
                y: r.pos_y,
            },
            size: Dimmension {
                x: r.size_x,
                y: r.size_y,
            },
            parent_id: r.parent_id,
            tag_ids,
            visibility: r.visibility,
            card_type: r.card_type,
            ok_count: r.ok_count,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}
