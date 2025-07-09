use sqlx::{mysql::MySqlPoolOptions, MySql, Pool};
use std::env;

pub async fn create_pool() -> Pool<MySql> {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    MySqlPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("failed to connect to DB")
}
