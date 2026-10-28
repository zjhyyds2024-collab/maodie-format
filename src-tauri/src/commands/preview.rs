use super::{file_ops::input, runtime::Runtime};
use crate::error::{AppError, Result};
use std::{io::Read, path::Path};
use tauri::AppHandle;

const TEXT_LIMIT: usize = 256 * 1024;
#[derive(serde::Serialize)]
pub struct Preview {
    kind: String,
    audio_info: Option<serde_json::Value>,
    size: u64,
    text: Option<String>,
    truncated: bool,
    bytes: Option<Vec<u8>>,
    pages: Option<u64>,
}
fn text_preview(path: &Path) -> Result<Preview> {
    let size = std::fs::metadata(path)?.len();
    let mut bytes = Vec::new();
    std::fs::File::open(path)?
        .take((TEXT_LIMIT + 1) as u64)
        .read_to_end(&mut bytes)?;
    let truncated = bytes.len() > TEXT_LIMIT;
    bytes.truncate(TEXT_LIMIT);
    Ok(Preview {
        kind: "text".into(),
        audio_info: None,
        size,
        text: Some(String::from_utf8_lossy(&bytes).into_owned()),
        truncated,
        bytes: None,
        pages: None,
    })
}
#[tauri::command]
pub async fn preview_file(app: AppHandle, path: String) -> Result<Preview> {
    let path = input(&path)?;
    let ext = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    let size = std::fs::metadata(&path)?.len();
    if matches!(
        ext.as_str(),
        "mp3" | "flac" | "m4a" | "ogg" | "opus" | "wav" | "aac" | "aiff" | "wma"
    ) {
        if size > 128 * 1024 * 1024 {
            return Err(AppError::ConversionFailed(
                "音频超过 128 MB 预览上限，请用系统应用打开。".into(),
            ));
        }
        let runtime = Runtime::from_app(&app)?;
        let dir = tempfile::tempdir()?;
        let output = dir.path().join("music.json");
        let request = dir.path().join("request.json");
        std::fs::write(&request,serde_json::to_vec(&serde_json::json!({"operation":"music-preview","input_paths":[path],"output_path":output})).unwrap())?;
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(15),
            tokio::process::Command::new(runtime.python)
                .arg(runtime.advanced)
                .arg(request)
                .kill_on_drop(true)
                .output(),
        )
        .await
        .map_err(|_| AppError::ConversionFailed("音频预览超时。".into()))??;
        if !result.status.success() {
            return Err(AppError::ConversionFailed(
                "音频标签暂无法预览，请使用系统应用打开。".into(),
            ));
        }
        let mut raw = Vec::new();
        std::fs::File::open(&output)?
            .take(64 * 1024)
            .read_to_end(&mut raw)?;
        let info = serde_json::from_slice(&raw)
            .map_err(|_| AppError::ConversionFailed("音频预览数据无效。".into()))?;
        let thumbnail = output.with_extension("png");
        let bytes = if thumbnail.is_file() {
            let mut data = Vec::new();
            std::fs::File::open(thumbnail)?
                .take(512 * 1024)
                .read_to_end(&mut data)?;
            Some(data)
        } else {
            None
        };
        return Ok(Preview {
            kind: "audio".into(),
            audio_info: Some(info),
            size,
            text: None,
            truncated: false,
            bytes,
            pages: None,
        });
    }
    if matches!(
        ext.as_str(),
        "txt"
            | "md"
            | "json"
            | "csv"
            | "tsv"
            | "xml"
            | "yaml"
            | "yml"
            | "log"
            | "html"
            | "htm"
            | "svg"
            | "rst"
    ) {
        return text_preview(&path);
    }
    if matches!(
        ext.as_str(),
        "png"
            | "jpg"
            | "jpeg"
            | "webp"
            | "avif"
            | "tif"
            | "tiff"
            | "gif"
            | "bmp"
            | "heic"
            | "heif"
            | "pdf"
    ) {
        if size > 128 * 1024 * 1024 {
            return Err(AppError::ConversionFailed(
                "文件超过 128 MB 预览上限，请用系统应用打开。".into(),
            ));
        }
        let runtime = Runtime::from_app(&app)?;
        let dir = tempfile::tempdir()?;
        let out = dir.path().join("thumbnail.png");
        let req = serde_json::json!({"operation":"preview","input_paths":[path],"output_path":out});
        let output = tokio::time::timeout(
            std::time::Duration::from_secs(20),
            tokio::process::Command::new(runtime.helper)
                .arg(req.to_string())
                .kill_on_drop(true)
                .output(),
        )
        .await
        .map_err(|_| AppError::ConversionFailed("预览超时，请使用系统应用打开。".into()))??;
        if !output.status.success() {
            return Err(AppError::ConversionFailed(
                String::from_utf8_lossy(&output.stderr)
                    .chars()
                    .take(1000)
                    .collect(),
            ));
        }
        let meta: serde_json::Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| AppError::ConversionFailed(e.to_string()))?;
        let mut bytes = Vec::new();
        std::fs::File::open(out)?
            .take(16 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)?;
        if bytes.len() > 16 * 1024 * 1024 {
            return Err(AppError::ConversionFailed("预览图片过大。".into()));
        }
        return Ok(Preview {
            kind: "image".into(),
            audio_info: None,
            size,
            text: None,
            truncated: false,
            bytes: Some(bytes),
            pages: meta["pages"].as_u64(),
        });
    }
    Ok(Preview {
        kind: "file".into(),
        audio_info: None,
        size,
        text: None,
        truncated: false,
        bytes: None,
        pages: None,
    })
}
#[tauri::command]
pub async fn open_result(path: String) -> Result<()> {
    let path = input(&path)?;
    let ext = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    if !matches!(
        ext.as_str(),
        "pdf"
            | "png"
            | "jpg"
            | "jpeg"
            | "webp"
            | "avif"
            | "tif"
            | "tiff"
            | "gif"
            | "bmp"
            | "heic"
            | "heif"
            | "txt"
            | "md"
            | "csv"
            | "tsv"
            | "json"
            | "xml"
            | "yaml"
            | "yml"
            | "log"
            | "doc"
            | "docx"
            | "odt"
            | "rtf"
            | "xls"
            | "xlsx"
            | "ods"
            | "ppt"
            | "pptx"
            | "odp"
            | "epub"
            | "mp3"
            | "wav"
            | "flac"
            | "m4a"
            | "aac"
            | "ogg"
            | "opus"
            | "wma"
            | "mp4"
            | "webm"
            | "mov"
            | "mkv"
            | "avi"
            | "m4v"
    ) {
        return Err(AppError::UnsupportedFormat(
            "请通过 Finder 查看此格式。".into(),
        ));
    }
    let status = tokio::process::Command::new("/usr/bin/open")
        .arg(&path)
        .status()
        .await?;
    if !status.success() {
        return Err(AppError::ProcessError("系统应用未能打开此文件。".into()));
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn text_is_bounded_and_markup_remains_text() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("preview.html");
        std::fs::write(
            &path,
            format!("<script>hello</script>{}", "中".repeat(TEXT_LIMIT)),
        )
        .unwrap();
        let preview = text_preview(&path).unwrap();
        assert!(preview.truncated);
        assert_eq!(preview.kind, "text");
        assert!(preview.text.as_ref().unwrap().starts_with("<script>"));
        assert!(preview.text.unwrap().len() <= TEXT_LIMIT + 3);
    }
}
