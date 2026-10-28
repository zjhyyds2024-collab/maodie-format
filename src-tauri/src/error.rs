use serde::Serialize;

#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(String),

    #[error("Conversion failed: {0}")]
    ConversionFailed(String),

    #[error("Unsupported format: {0}")]
    UnsupportedFormat(String),

    #[error("Sidecar not found: {0}")]
    SidecarNotFound(String),

    #[error("Process error: {0}")]
    ProcessError(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
