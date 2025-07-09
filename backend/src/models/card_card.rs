use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Serialize, Deserialize)]
pub struct CardCardParams {
    pub card_parent_id: i64,
    pub card_child_id: i64,
    pub connector: String,
}

#[derive(FromRow, Serialize, Deserialize)]
pub struct CardRelation {
    pub card_parent_id: i64,
    pub card_child_id: i64,
    pub connector: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
