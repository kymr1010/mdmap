use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::schema::Dimmension;

#[derive(Serialize, Deserialize)]
pub struct Card {
    pub id: i64,
    pub position: Dimmension,
    pub size: Dimmension,
    pub title: String,
    pub contents: String,
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
}
