use serde::{Deserialize, Serialize};
#[derive(Deserialize)]
pub struct RangeParams {
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
}

#[derive(Serialize, Deserialize)]
pub struct Dimmension { pub x: f64, pub y: f64 }