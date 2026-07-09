use std::{
    collections::HashMap,
    env,
    sync::{Arc, Mutex},
};

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Algorithm, Argon2, Params, Version,
};
use axum::{
    extract::{Request, State},
    http::{
        header::{AUTHORIZATION, COOKIE, SET_COOKIE},
        HeaderMap, HeaderValue, Method, StatusCode,
    },
    middleware::Next,
    response::{IntoResponse, Response},
    Extension, Json,
};
use rand::{distr::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use sqlx::{MySql, Pool};

use crate::models::{ApiResponse, UserRow};

const SESSION_COOKIE: &str = "memoapp_session";

/// Who a session belongs to. Kept for future per-user / per-role features.
#[derive(Clone)]
#[allow(dead_code)]
pub struct SessionUser {
    pub user_id: i64,
    pub role: String,
}

#[derive(Clone)]
pub struct AuthState {
    sessions: Arc<Mutex<HashMap<String, SessionUser>>>,
    cookie_secure: bool,
    /// Optional server-side secret ("pepper") mixed into every password hash.
    /// Lives only in the environment, never in the database.
    pepper: Vec<u8>,
}

#[derive(Deserialize)]
pub struct LoginParams {
    password: String,
}

#[derive(Serialize)]
pub struct AuthStatus {
    authenticated: bool,
    auth_enabled: bool,
}

#[derive(Serialize)]
pub struct ApiTokenResponse {
    token: String,
    prefix: String,
}

#[derive(sqlx::FromRow)]
struct ApiKeyUserRow {
    id: i64,
    role: String,
    api_key_hash: String,
}

impl AuthState {
    pub fn from_env() -> Self {
        let cookie_secure = env::var("MEMOAPP_COOKIE_SECURE")
            .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
            .unwrap_or(false);
        let pepper = env::var("MEMOAPP_PASSWORD_PEPPER")
            .ok()
            .filter(|value| !value.is_empty())
            .map(|value| value.into_bytes())
            .unwrap_or_default();

        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            cookie_secure,
            pepper,
        }
    }

    /// Argon2 instance, keyed with the pepper when one is configured.
    fn argon2(&self) -> Argon2<'_> {
        if self.pepper.is_empty() {
            Argon2::default()
        } else {
            Argon2::new_with_secret(&self.pepper, Algorithm::Argon2id, Version::V0x13, Params::default())
                .expect("invalid argon2 configuration (pepper too long?)")
        }
    }

    /// Hash a plaintext password into an argon2 PHC string (with per-user salt).
    pub fn hash_password(&self, password: &str) -> Result<String, String> {
        let salt = SaltString::generate(&mut OsRng);
        self.argon2()
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|e| e.to_string())
    }

    /// Verify a plaintext password against a stored argon2 PHC string.
    fn verify_password(&self, password: &str, hash: &str) -> bool {
        match PasswordHash::new(hash) {
            Ok(parsed) => self
                .argon2()
                .verify_password(password.as_bytes(), &parsed)
                .is_ok(),
            Err(_) => false,
        }
    }

    pub fn is_authenticated(&self, headers: &HeaderMap) -> bool {
        let Some(token) = session_token_from_headers(headers) else {
            return false;
        };

        self.sessions
            .lock()
            .map(|sessions| sessions.contains_key(token))
            .unwrap_or(false)
    }

    /// The user behind the current session, if any. Reserved for future
    /// per-user / role-based authorization.
    #[allow(dead_code)]
    pub fn current_user(&self, headers: &HeaderMap) -> Option<SessionUser> {
        let token = session_token_from_headers(headers)?;
        self.sessions
            .lock()
            .ok()
            .and_then(|sessions| sessions.get(token).cloned())
    }

    fn create_session(&self, user: SessionUser) -> String {
        let token: String = rand::rng()
            .sample_iter(&Alphanumeric)
            .take(64)
            .map(char::from)
            .collect();

        if let Ok(mut sessions) = self.sessions.lock() {
            sessions.insert(token.clone(), user);
        }

        token
    }

    fn remove_session(&self, headers: &HeaderMap) {
        let Some(token) = session_token_from_headers(headers) else {
            return;
        };

        if let Ok(mut sessions) = self.sessions.lock() {
            sessions.remove(token);
        }
    }

    pub async fn api_key_user(&self, pool: &Pool<MySql>, headers: &HeaderMap) -> Option<SessionUser> {
        let token = bearer_token_from_headers(headers)?;
        let users = sqlx::query_as::<_, ApiKeyUserRow>(
            "SELECT id, role, api_key_hash FROM users WHERE is_active = TRUE AND api_key_hash IS NOT NULL",
        )
        .fetch_all(pool)
        .await
        .ok()?;

        users.into_iter().find_map(|user| {
            self.verify_password(token, &user.api_key_hash)
                .then_some(SessionUser {
                    user_id: user.id,
                    role: user.role,
                })
        })
    }

    fn session_cookie(&self, token: &str) -> String {
        let secure = if self.cookie_secure { "; Secure" } else { "" };
        format!(
            "{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000{secure}"
        )
    }

    fn clear_cookie(&self) -> String {
        let secure = if self.cookie_secure { "; Secure" } else { "" };
        format!("{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0{secure}")
    }
}

/// Ensure an admin user exists. On first run, if MEMOAPP_ADMIN_PASSWORD is set
/// and there is no `admin` user yet, create one with a hashed password. This
/// migrates the bootstrap password from the environment into the database;
/// afterwards the DB is the source of truth (the env value is only used to seed).
pub async fn bootstrap_admin(pool: &Pool<MySql>, state: &AuthState) -> Result<(), String> {
    let Some(password) = env::var("MEMOAPP_ADMIN_PASSWORD")
        .ok()
        .filter(|value| !value.is_empty())
    else {
        return Ok(());
    };

    let existing: Option<i64> = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

    if existing.is_some() {
        return Ok(());
    }

    let hash = state.hash_password(&password)?;
    sqlx::query("INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')")
        .bind(&hash)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("bootstrapped 'admin' user from MEMOAPP_ADMIN_PASSWORD");
    Ok(())
}

/// True when at least one active user exists (i.e. login is possible).
async fn auth_enabled(pool: &Pool<MySql>) -> bool {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE is_active = TRUE")
        .fetch_one(pool)
        .await
        .map(|count| count > 0)
        .unwrap_or(false)
}

pub async fn status(
    State(state): State<AuthState>,
    Extension(pool): Extension<Pool<MySql>>,
    headers: HeaderMap,
) -> ApiResponse<AuthStatus> {
    ApiResponse::new_ok(
        StatusCode::OK,
        AuthStatus {
            authenticated: state.is_authenticated(&headers),
            auth_enabled: auth_enabled(&pool).await,
        },
    )
}

pub async fn login(
    State(state): State<AuthState>,
    Extension(pool): Extension<Pool<MySql>>,
    Json(params): Json<LoginParams>,
) -> Response {
    // Password-only login: match the submitted password against each active
    // user's hash to identify who is logging in.
    let users = match sqlx::query_as::<_, UserRow>(
        "SELECT id, username, password_hash, role FROM users WHERE is_active = TRUE",
    )
    .fetch_all(&pool)
    .await
    {
        Ok(users) => users,
        Err(e) => {
            return ApiResponse::<AuthStatus>::new_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                e.to_string(),
            )
            .into_response();
        }
    };

    let matched = users
        .into_iter()
        .find(|user| state.verify_password(&params.password, &user.password_hash));

    let Some(user) = matched else {
        return ApiResponse::<AuthStatus>::new_err(StatusCode::UNAUTHORIZED, "invalid password")
            .into_response();
    };

    let token = state.create_session(SessionUser {
        user_id: user.id,
        role: user.role,
    });

    let mut response = ApiResponse::new_ok(
        StatusCode::OK,
        AuthStatus {
            authenticated: true,
            auth_enabled: true,
        },
    )
    .into_response();

    if let Ok(cookie) = HeaderValue::from_str(&state.session_cookie(&token)) {
        response.headers_mut().insert(SET_COOKIE, cookie);
    }

    response
}

pub async fn logout(
    State(state): State<AuthState>,
    Extension(pool): Extension<Pool<MySql>>,
    headers: HeaderMap,
) -> Response {
    state.remove_session(&headers);
    let mut response = ApiResponse::new_ok(
        StatusCode::OK,
        AuthStatus {
            authenticated: false,
            auth_enabled: auth_enabled(&pool).await,
        },
    )
    .into_response();

    if let Ok(cookie) = HeaderValue::from_str(&state.clear_cookie()) {
        response.headers_mut().insert(SET_COOKIE, cookie);
    }

    response
}

pub async fn generate_api_token(
    State(state): State<AuthState>,
    Extension(pool): Extension<Pool<MySql>>,
    headers: HeaderMap,
) -> Response {
    let Some(user) = state.current_user(&headers) else {
        return ApiResponse::<ApiTokenResponse>::new_err(
            StatusCode::UNAUTHORIZED,
            "login required",
        )
        .into_response();
    };

    let token = generate_api_token_value();
    let prefix = token.chars().take(12).collect::<String>();
    let hash = match state.hash_password(&token) {
        Ok(hash) => hash,
        Err(e) => {
            return ApiResponse::<ApiTokenResponse>::new_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                e,
            )
            .into_response();
        }
    };

    let result = sqlx::query(
        "UPDATE users SET api_key_hash = ?, api_key_prefix = ? WHERE id = ? AND is_active = TRUE",
    )
    .bind(hash)
    .bind(&prefix)
    .bind(user.user_id)
    .execute(&pool)
    .await;

    match result {
        Ok(result) if result.rows_affected() > 0 => ApiResponse::new_ok(
            StatusCode::OK,
            ApiTokenResponse { token, prefix },
        )
        .into_response(),
        Ok(_) => ApiResponse::<ApiTokenResponse>::new_err(
            StatusCode::UNAUTHORIZED,
            "login required",
        )
        .into_response(),
        Err(e) => ApiResponse::<ApiTokenResponse>::new_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            e.to_string(),
        )
        .into_response(),
    }
}

pub async fn require_write_auth(
    State(state): State<AuthState>,
    Extension(pool): Extension<Pool<MySql>>,
    req: Request,
    next: Next,
) -> Response {
    if req.uri().path().starts_with("/auth/") {
        return next.run(req).await;
    }

    if matches!(req.method(), &Method::GET | &Method::HEAD | &Method::OPTIONS) {
        return next.run(req).await;
    }

    if req.uri().path() == "/cards/flush_json" {
        if state.api_key_user(&pool, req.headers()).await.is_some() {
            return next.run(req).await;
        }

        return ApiResponse::<()>::new_err(
            StatusCode::UNAUTHORIZED,
            "api token required",
        )
        .into_response();
    }

    if state.is_authenticated(req.headers()) {
        return next.run(req).await;
    }

    if state.api_key_user(&pool, req.headers()).await.is_some() {
        return next.run(req).await;
    }

    ApiResponse::<()>::new_err(StatusCode::UNAUTHORIZED, "authentication required").into_response()
}

fn generate_api_token_value() -> String {
    let value: String = rand::rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect();
    format!("memo_{value}")
}

fn session_token_from_headers(headers: &HeaderMap) -> Option<&str> {
    let cookie = headers.get(COOKIE)?.to_str().ok()?;

    cookie.split(';').find_map(|part| {
        let (name, value) = part.trim().split_once('=')?;
        (name == SESSION_COOKIE && !value.is_empty()).then_some(value)
    })
}

fn bearer_token_from_headers(headers: &HeaderMap) -> Option<&str> {
    let value = headers.get(AUTHORIZATION)?.to_str().ok()?;
    value.strip_prefix("Bearer ").filter(|token| !token.is_empty())
}
