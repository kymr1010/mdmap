use crate::handlers::card_card::{
    connect_card_to_card, disconnect_card_to_card, get_connectors, update_connector,
};
use crate::handlers::cards::{
    create_card, delete_card, get_cards, get_cards_in_range, update_card,
};
use crate::handlers::tags::{create_tag, delete_tag, get_tags, update_tag};
use axum::routing::{get, post};
use axum::Router;

pub fn router() -> Router {
    Router::new()
        .route("/", get(|| async { "Hello, World! 🎉" }))
        .route("/cards", get(get_cards))
        .route("/cards/in_range", get(get_cards_in_range))
        .route(
            "/cards_connect",
            get(get_connectors)
                .post(connect_card_to_card)
                .patch(update_connector)
                .delete(disconnect_card_to_card),
        )
        .route(
            "/card",
            post(create_card).patch(update_card).delete(delete_card),
        )
        .route("/tags", get(get_tags))
        .route(
            "/tag",
            post(create_tag).patch(update_tag).delete(delete_tag),
        )
}
