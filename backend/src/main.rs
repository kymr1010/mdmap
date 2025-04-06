use axum::{
  Router,
  routing::get,
};
use tower_http::cors::{CorsLayer, Any};
use tower::ServiceBuilder;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
  // 1. CORS Layer を構築
  let cors = CorsLayer::new()
      .allow_origin(Any)               // ← * 任意のオリジンを許可
      .allow_methods(Any)              // ← * 任意のメソッドを許可
      .allow_headers(Any);             // ← * 任意のヘッダーを許可

  // 2. アプリケーションルーター構築
  let app = Router::new()
      .route("/", get(|| async { "Hello, World! 🎉" }))
      .layer(ServiceBuilder::new().layer(cors)); // ← ServiceBuilderで包む

  // 3. 起動
  let addr = SocketAddr::from(([0, 0, 0, 0], 8082));
  println!("Listening on {}", addr);
  let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
  axum::serve(listener, app).await.unwrap();
}
