use crate::handlers::cards::{create_card, get_cards_in_range, update_card};
use axum::routing::{get, post};
use axum::Router;

pub fn router() -> Router {
    Router::new()
        .route("/", get(|| async { "Hello, World! 🎉" }))
        .route("/cards", get(get_cards_in_range))
        .route("/card", post(create_card).patch(update_card))
}
