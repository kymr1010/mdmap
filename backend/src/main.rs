use axum::{
    http::{header::CONTENT_TYPE, HeaderValue, Method},
    Extension,
};
use std::env;
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

// mod config;
mod auth;
mod db;
mod handlers;
mod models;
mod routes;
mod schema;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // .env から DB 接続情報をロード
    dotenvy::dotenv().ok();

    // DB プール
    let pool = db::create_pool().await;
    let auth_state = auth::AuthState::from_env();

    // CORS
    let frontend_origin =
        env::var("MEMOAPP_FRONTEND_ORIGIN").unwrap_or_else(|_| "http://localhost:5173".into());
    let frontend_origin = HeaderValue::from_str(&frontend_origin)?;
    let cors = CorsLayer::new()
        .allow_origin(frontend_origin)
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
        .allow_headers([CONTENT_TYPE])
        .allow_credentials(true);

    let trace = TraceLayer::new_for_http();

    // ルーター組み立て
    let app = routes::router(auth_state)
        .layer(cors)
        .layer(trace)
        .layer(Extension(pool));

    // サーバ起動
    let addr = SocketAddr::from(([0, 0, 0, 0], 8082));
    println!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}
