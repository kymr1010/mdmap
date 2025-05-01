use axum::{
  Router,
  routing::get,
};
use tower_http::cors::{CorsLayer, Any};
use tower::ServiceBuilder;
use std::net::SocketAddr;
use serde::{Deserialize, Serialize};
use sqlx::{mysql::MySqlPoolOptions, FromRow, MySql, Pool};
use std::env;
use rand::prelude::*;
use lipsum::lipsum;

#[derive(Serialize)]
struct Dimmension {
    x: f64,
    y: f64,
}

/// フロント向けのカード型
#[derive(Serialize)]
struct Card {
    position: Dimmension,
    size:     Dimmension,
    title:    String,
    contents: String,
}

/// /cards?minX=..&minY=..&maxX=..&maxY=..
#[derive(Deserialize)]
struct RangeParams {
    min_x: f64,
    min_y: f64,
    max_x: f64,
    max_y: f64,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // .env から DB 接続情報をロード
    dotenvy::dotenv().ok();

    // シード用トランザクション
    let database_url = env::var("DATABASE_URL")?;
    let pool: Pool<MySql> = MySqlPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    // let mut tx = pool.begin().await?;
    let mut rng = rand::rng();

    // 例として 500 件をランダム挿入
    for _ in 0..100 {
        // ランダムな四隅の座標を作るために、左下 (x,y) と幅 w, 高さ h を決定
        let mut nums: Vec<i32> = (-100_00..=100_00).collect();
        nums.shuffle(&mut rng);
        let x: i32 = *nums.choose(&mut rng).unwrap();
        let y: i32 = *nums.choose(&mut rng).unwrap();

        let mut nums: Vec<i32> = (100..=500).collect();
        nums.shuffle(&mut rng);
        let w: i32 = *nums.choose(&mut rng).unwrap();
        let h: i32 = *nums.choose(&mut rng).unwrap();

        // WKT 形式の POLYGON を生成（閉じ Point を最後に繰り返す）
        // (x,y)->(x+w,y)->(x+w,y+h)->(x,y+h)->(x,y)
        let polygon_wkt = format!(
            "POLYGON(({} {}, {} {}, {} {}, {} {}, {} {}))",
            x,     y,
            x + w, y,
            x + w, y + h,
            x,     y + h,
            x,     y
        );

        // ランダム文字列をタイトル／コンテンツに
        let title: String = lipsum(2);
        let contents: String = lipsum(100);

        sqlx::query!(
            r#"
            INSERT INTO cards (title, contents, shape)
            VALUES (?, ?, ST_GeomFromText(?))
            "#,
            title, contents, polygon_wkt
        )
        .execute(&pool)
        .await?;
    }

    // tx.commit().await?;
    println!("Seeded random POLYGON cards.");

      // 1. CORS Layer を構築
  let cors = CorsLayer::new()
      .allow_origin(Any)               // ← * 任意のオリジンを許可
      .allow_methods(Any)              // ← * 任意のメソッドを許可
      .allow_headers(Any);             // ← * 任意のヘッダーを許可

  // 2. アプリケーションルーター構築
  let app = Router::new()
        // ルート（変更なし）
        .route("/", get(|| async { "Hello, World! 🎉" }))
        // 範囲検索エンドポイントを追加
        .route("/cards", get(get_cards_in_range))
        // プールをハンドラに渡す
        .layer(ServiceBuilder::new().layer(cors))
        .layer(axum::Extension(pool));

  // 3. 起動
  let addr = SocketAddr::from(([0, 0, 0, 0], 8082));
  println!("Listening on {}", addr);
  let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
  axum::serve(listener, app).await.unwrap();

  Ok(())
}

#[derive(sqlx::FromRow)]
struct CardRow {
    pos_x:    f64,
    pos_y:    f64,
    size_x:   f64,
    size_y:   f64,
    title:    String,
    contents: String,
}

async fn get_cards_in_range(
  axum::extract::Query(params): axum::extract::Query<RangeParams>,
  axum::Extension(pool): axum::Extension<Pool<MySql>>,
) -> axum::Json<Vec<Card>> {
  // クエリパラメータをもとに矩形ポリゴンを WKT で作成
  let poly = format!(
      "POLYGON((\
       {minX} {minY}, {maxX} {minY}, \
       {maxX} {maxY}, {minX} {maxY}, \
       {minX} {minY} \
     ))",
      minX = params.min_x,
      minY = params.min_y,
      maxX = params.max_x,
      maxY = params.max_y,
  );

  println!("{}",poly);

  // MBRIntersects で当たり判定
  let rows = sqlx::query_as::<_, CardRow>(r#"
      SELECT
          ST_X(ST_PointN(ST_ExteriorRing(shape), 1))                             AS pos_x,
          ST_Y(ST_PointN(ST_ExteriorRing(shape), 1))                             AS pos_y,
          (ST_X(ST_PointN(ST_ExteriorRing(shape), 3)) - ST_X(ST_PointN(ST_ExteriorRing(shape), 1))) AS size_x,
          (ST_Y(ST_PointN(ST_ExteriorRing(shape), 3)) - ST_Y(ST_PointN(ST_ExteriorRing(shape), 1))) AS size_y,
          id, title, contents
      FROM cards
      WHERE MBRIntersects(shape, ST_GeomFromText(?))
  "#)
  .bind(&poly)
  .fetch_all(&pool)
  .await
  .unwrap_or_default();

  let cards: Vec<Card> = rows.into_iter().map(|r| Card {
    position: Dimmension { x: r.pos_x, y: r.pos_y },
    size:     Dimmension { x: r.size_x, y: r.size_y },
    title:    r.title,
    contents: r.contents,
  }).collect();

  println!("Found {} cards in range.", cards[0].position.x);

  axum::Json(cards)
}