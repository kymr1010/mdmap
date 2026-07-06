use std::{
    collections::HashSet,
    env,
    sync::{Arc, Mutex},
};

use axum::{
    extract::{Request, State},
    http::{
        header::{COOKIE, SET_COOKIE},
        HeaderMap, HeaderValue, Method, StatusCode,
    },
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use rand::{distr::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};

use crate::models::ApiResponse;

const SESSION_COOKIE: &str = "memoapp_session";

#[derive(Clone)]
pub struct AuthState {
    admin_password: Option<String>,
    sessions: Arc<Mutex<HashSet<String>>>,
    cookie_secure: bool,
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

impl AuthState {
    pub fn from_env() -> Self {
        let admin_password = env::var("MEMOAPP_ADMIN_PASSWORD")
            .ok()
            .filter(|password| !password.is_empty());
        let cookie_secure = env::var("MEMOAPP_COOKIE_SECURE")
            .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
            .unwrap_or(false);

        Self {
            admin_password,
            sessions: Arc::new(Mutex::new(HashSet::new())),
            cookie_secure,
        }
    }

    fn auth_enabled(&self) -> bool {
        self.admin_password.is_some()
    }

    fn is_authenticated(&self, headers: &HeaderMap) -> bool {
        let Some(token) = session_token_from_headers(headers) else {
            return false;
        };

        self.sessions
            .lock()
            .map(|sessions| sessions.contains(token))
            .unwrap_or(false)
    }

    fn create_session(&self) -> String {
        let token: String = rand::rng()
            .sample_iter(&Alphanumeric)
            .take(64)
            .map(char::from)
            .collect();

        if let Ok(mut sessions) = self.sessions.lock() {
            sessions.insert(token.clone());
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

pub async fn status(
    State(state): State<AuthState>,
    headers: HeaderMap,
) -> ApiResponse<AuthStatus> {
    ApiResponse::new_ok(
        StatusCode::OK,
        AuthStatus {
            authenticated: state.is_authenticated(&headers),
            auth_enabled: state.auth_enabled(),
        },
    )
}

pub async fn login(
    State(state): State<AuthState>,
    Json(params): Json<LoginParams>,
) -> Response {
    let Some(admin_password) = state.admin_password.as_ref() else {
        return ApiResponse::<AuthStatus>::new_err(
            StatusCode::SERVICE_UNAVAILABLE,
            "admin password is not configured",
        )
        .into_response();
    };

    if params.password != *admin_password {
        return ApiResponse::<AuthStatus>::new_err(StatusCode::UNAUTHORIZED, "invalid password")
            .into_response();
    }

    let token = state.create_session();
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

pub async fn logout(State(state): State<AuthState>, headers: HeaderMap) -> Response {
    state.remove_session(&headers);
    let mut response = ApiResponse::new_ok(
        StatusCode::OK,
        AuthStatus {
            authenticated: false,
            auth_enabled: state.auth_enabled(),
        },
    )
    .into_response();

    if let Ok(cookie) = HeaderValue::from_str(&state.clear_cookie()) {
        response.headers_mut().insert(SET_COOKIE, cookie);
    }

    response
}

pub async fn require_write_auth(
    State(state): State<AuthState>,
    req: Request,
    next: Next,
) -> Response {
    if req.uri().path().starts_with("/auth/") {
        return next.run(req).await;
    }

    if matches!(req.method(), &Method::GET | &Method::HEAD | &Method::OPTIONS) {
        return next.run(req).await;
    }

    if state.auth_enabled() && state.is_authenticated(req.headers()) {
        return next.run(req).await;
    }

    ApiResponse::<()>::new_err(StatusCode::UNAUTHORIZED, "authentication required")
        .into_response()
}

fn session_token_from_headers(headers: &HeaderMap) -> Option<&str> {
    let cookie = headers.get(COOKIE)?.to_str().ok()?;

    cookie.split(';').find_map(|part| {
        let (name, value) = part.trim().split_once('=')?;
        (name == SESSION_COOKIE && !value.is_empty()).then_some(value)
    })
}
