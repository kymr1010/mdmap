use axum::{Router, Extension};
use tower_http::cors::{CorsLayer, Any};
use tower::ServiceBuilder;
use std::net::SocketAddr;

// mod config;
mod db;
mod models;
mod handlers;
mod routes;
mod schema;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // .env から DB 接続情報をロード
    dotenvy::dotenv().ok();

    // DB プール
    let pool = db::create_pool().await;

    // CORS
    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any);

    // ルーター組み立て
    let app = routes::router()
        .layer(ServiceBuilder::new().layer(cors))
        .layer(Extension(pool));

    // サーバ起動
    let addr = SocketAddr::from(([0,0,0,0], 8082));
    println!("Listening on {}", addr);
    println!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}
