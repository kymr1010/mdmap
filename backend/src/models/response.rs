use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Serialize)]
pub struct ApiResponse<T> {
    code: u16,
    message: String,
    data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn new_ok(status: StatusCode, data: T) -> Self {
        Self {
            code: status.as_u16(),
            message: "OK".into(),
            data: Some(data),
        }
    }

    pub fn new_err(status: StatusCode, msg: impl Into<String>) -> Self {
        Self {
            code: status.as_u16(),
            message: msg.into(),
            data: None,
        }
    }
}

impl<T> IntoResponse for ApiResponse<T>
where
    T: Serialize,
{
    fn into_response(self) -> Response {
        (
            StatusCode::from_u16(self.code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            Json(self),
        )
            .into_response()
    }
}
