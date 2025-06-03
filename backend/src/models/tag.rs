use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Serialize, Deserialize)]
pub struct Tag {
    pub id: i32,
    pub name: String,
}

#[derive(FromRow)]
pub struct TagRow {
    pub id: i32,
    pub name: String,
}
