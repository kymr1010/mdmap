use sqlx::FromRow;

/// A row from the `users` table, used internally for authentication.
/// Never serialized to API responses (it contains the password hash).
#[derive(FromRow)]
pub struct UserRow {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub role: String,
}
