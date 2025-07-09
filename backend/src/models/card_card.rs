use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Serialize, Deserialize, FromRow)]
pub struct CardCardRow {
    pub card_parent_id: i64,
    pub card_child_id: i64,
    pub path: String,
}

#[derive(Serialize, Deserialize, FromRow)]
pub struct CardRelation {
    pub card_parent_id: i64,
    pub card_child_id: i64,
    pub path: String,
}
