use crate::error::{AppError, Result};
use tauri::{AppHandle, Manager};
const FEEDBACK_EMAIL: &str = "zjhyyds2024@gmail.com";
#[tauri::command]
pub fn default_output_directory(app: AppHandle) -> Result<String> {
    let path = app
        .path()
        .download_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    if !path.is_dir() {
        return Err(AppError::Io(
            "下载文件夹不存在，请自行选择保存目录。".into(),
        ));
    }
    Ok(path.to_string_lossy().into_owned())
}
fn uri_component(value: &str) -> String {
    value
        .bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) {
                (b as char).to_string()
            } else {
                format!("%{b:02X}")
            }
        })
        .collect()
}
#[tauri::command]
pub async fn open_feedback(subject: String, body: String) -> Result<()> {
    if subject.len() > 500 || body.len() > 30000 || body.trim().is_empty() {
        return Err(AppError::ConversionFailed("请填写有效的反馈内容。".into()));
    }
    let url = format!(
        "mailto:{}?subject={}&body={}",
        FEEDBACK_EMAIL,
        uri_component(&subject),
        uri_component(&body)
    );
    let status = tokio::process::Command::new("/usr/bin/open")
        .arg(url)
        .status()
        .await?;
    if !status.success() {
        return Err(AppError::ProcessError(format!(
            "无法打开邮件应用，请手动发送到 {FEEDBACK_EMAIL}。"
        )));
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn feedback_message_cannot_change_recipient_or_query() {
        let value = uri_component("中文 &bcc=other@example.com\n#?");
        assert!(value.starts_with("%E4%B8%AD%E6%96%87"));
        assert!(!value.contains('&'));
        assert!(!value.contains('#'));
        assert!(!value.contains('\n'));
    }
}
