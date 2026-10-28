use crate::error::{AppError, Result};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::Stdio,
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
    sync::watch,
};

pub struct Jobs {
    pub active: Mutex<HashMap<String, watch::Sender<bool>>>,
    pub results: tempfile::TempDir,
}
impl Default for Jobs {
    fn default() -> Self {
        Self {
            active: Mutex::new(HashMap::new()),
            results: tempfile::Builder::new()
                .prefix("vert-enhanced-")
                .tempdir()
                .expect("Cannot create conversion workspace"),
        }
    }
}
#[derive(Clone)]
pub struct Runtime {
    pub helper: PathBuf,
    pub pandoc: PathBuf,
    pub ffmpeg: PathBuf,
    pub magick: PathBuf,
    pub office: PathBuf,
    pub python: PathBuf,
    pub advanced: PathBuf,
    pub fontconfig: PathBuf,
}
impl Runtime {
    pub fn resolve(resource: &Path) -> Self {
        if let Some(home) = std::env::var_os("HOME") {
            let _ = std::fs::create_dir_all(
                PathBuf::from(home).join("Library/Caches/vert-enhanced/fontconfig"),
            );
        }
        let local = std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_default()
            .join(".local/share/vert-enhanced");
        let engines = std::env::var_os("VERT_ENGINE_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| local.join("engines"));
        let native = if resource.join("native-bin/vert-document-tools").is_file() {
            resource.join("native-bin")
        } else {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("native-bin")
        };
        let office = [
            local.join("LibreOffice.app/Contents/MacOS/soffice"),
            PathBuf::from("/Applications/LibreOffice.app/Contents/MacOS/soffice"),
        ]
        .into_iter()
        .find(|p| p.is_file())
        .unwrap_or_else(|| local.join("LibreOffice.app/Contents/MacOS/soffice"));
        Self {
            helper: native.join("vert-document-tools"),
            pandoc: engines.join("bin/pandoc"),
            ffmpeg: engines.join("bin/ffmpeg"),
            magick: engines.join("bin/magick"),
            python: engines.join("bin/python"),
            advanced: if resource.join("python/advanced_tools.py").is_file() {
                resource.join("python/advanced_tools.py")
            } else {
                PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("python/advanced_tools.py")
            },
            fontconfig: if resource.join("fonts/fonts.conf").is_file() {
                resource.join("fonts/fonts.conf")
            } else {
                PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fonts/fonts.conf")
            },
            office,
        }
    }
    pub fn from_app(app: &AppHandle) -> Result<Self> {
        Ok(Self::resolve(
            &app.path()
                .resource_dir()
                .map_err(|e| AppError::ProcessError(e.to_string()))?,
        ))
    }
}
#[derive(Clone)]
pub struct Control {
    pub receiver: watch::Receiver<bool>,
    pub app: Option<AppHandle>,
    pub id: String,
}
impl Control {
    pub fn check(&self) -> Result<()> {
        if *self.receiver.borrow() {
            Err(AppError::ConversionFailed("任务已取消".into()))
        } else {
            Ok(())
        }
    }
    pub fn stage(&self, stage: &str) {
        if let Some(app) = &self.app {
            let _ = app.emit(
                "conversion-progress",
                serde_json::json!({"job_id":self.id,"stage":stage}),
            );
        }
    }
}
async fn collect<R: tokio::io::AsyncRead + Unpin>(
    reader: R,
    control: Option<Control>,
) -> std::io::Result<String> {
    let mut lines = BufReader::new(reader).lines();
    let mut collected = String::new();
    while let Some(line) = lines.next_line().await? {
        if let Some(control) = &control {
            if let Ok(mut value) = serde_json::from_str::<serde_json::Value>(&line) {
                if value.get("current").is_some() && value.get("total").is_some() {
                    value["job_id"] = serde_json::json!(control.id);
                    if let Some(app) = &control.app {
                        let _ = app.emit("conversion-progress", value);
                    }
                }
            }
        }
        collected.push_str(&line);
        collected.push('\n');
        if collected.len() > 131072 {
            let mut index = collected.len() - 65536;
            while !collected.is_char_boundary(index) {
                index += 1;
            }
            collected.drain(..index);
        }
    }
    Ok(collected)
}
fn process_error_message(error: &str, output: &str) -> String {
    let raw = if error.trim().is_empty() {
        output.trim()
    } else {
        error.trim()
    };
    let lines: Vec<&str> = raw
        .lines()
        .filter(|line| {
            !(line.contains("FutureWarning:")
                || line.contains("DeprecationWarning:")
                || line.contains("Fontconfig warning:")
                || line.contains("No writable cache directories")
                || line.contains("CG_PDF_VERBOSE")
                || line.contains("telemetry") && line.contains("Failed to persist"))
        })
        .collect();
    let useful = lines.join("\n");
    let message = if useful.trim().is_empty() {
        raw
    } else {
        useful.trim()
    };
    let tail: String = message
        .chars()
        .rev()
        .take(3000)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    tail
}

pub async fn run(program: &Path, args: &[String], control: &Control) -> Result<String> {
    run_with_env(program, args, control, &[]).await
}

pub async fn run_with_env(
    program: &Path,
    args: &[String],
    control: &Control,
    environment: &[(&str, &std::ffi::OsStr)],
) -> Result<String> {
    control.check()?;
    if !program.is_file() {
        return Err(AppError::SidecarNotFound(format!(
            "未找到转换组件：{}。请按安装说明恢复组件。",
            program.display()
        )));
    }
    let mut command = Command::new(program);
    command.envs(environment.iter().map(|(key, value)| (*key, *value)));
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(unix)]
    command.process_group(0);
    let mut child = command
        .spawn()
        .map_err(|e| AppError::ProcessError(format!("{}: {}", program.display(), e)))?;
    let pid = child.id();
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let mut receiver = control.receiver.clone();
    let wait = async move {
        tokio::join!(
            collect(stdout, Some(control.clone())),
            collect(stderr, None),
            child.wait()
        )
    };
    let (out, err, status) = tokio::select! {
        result = wait => result,
        _ = receiver.changed() => {
            #[cfg(unix)] if let Some(pid) = pid { unsafe { libc::kill(-(pid as i32), libc::SIGKILL); } }
            return Err(AppError::ConversionFailed("任务已取消".into()));
        }
    };
    control.check()?;
    let output = out.map_err(AppError::from)?;
    let error = err.map_err(AppError::from)?;
    if !status.map_err(AppError::from)?.success() {
        return Err(AppError::ConversionFailed(process_error_message(
            &error, &output,
        )));
    }
    Ok(output)
}
#[derive(serde::Serialize)]
pub struct EngineStatus {
    pub name: String,
    pub available: bool,
    pub detail: String,
}
#[tauri::command]
pub async fn engine_status(app: AppHandle) -> Result<Vec<EngineStatus>> {
    let runtime = Runtime::from_app(&app)?;
    let mut statuses = vec![];
    for (name, path, args) in [
        ("音视频 · FFmpeg", runtime.ffmpeg, vec!["-version"]),
        ("图片 · ImageMagick", runtime.magick, vec!["-version"]),
        ("文档 · Pandoc", runtime.pandoc, vec!["--version"]),
        (
            "Office · LibreOffice",
            runtime.office,
            vec!["--headless", "--version"],
        ),
        ("扩展文本 / PDF / ZIP",runtime.python,vec!["-c","import pdf2docx, pdfplumber, openpyxl, pypdf, yaml, defusedxml, mutagen; from Crypto.Cipher import AES; print('结构化文本 / PDF Word / 原生表格 / ZIP 就绪')"]),
    ] {
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(12),
            Command::new(&path).args(args).kill_on_drop(true).output(),
        )
        .await;
        let (available, detail) = match result {
            Ok(Ok(out)) if out.status.success() => (
                true,
                String::from_utf8_lossy(&out.stdout)
                    .lines()
                    .next()
                    .unwrap_or("就绪")
                    .to_string(),
            ),
            Ok(Ok(out)) => (
                false,
                String::from_utf8_lossy(&out.stderr)
                    .chars()
                    .take(250)
                    .collect(),
            ),
            Ok(Err(err)) => (false, format!("{} · {}", path.display(), err)),
            Err(_) => (false, "检查超时，请检查组件是否能启动".into()),
        };
        statuses.push(EngineStatus {
            name: name.into(),
            available,
            detail,
        });
    }
    statuses.push(EngineStatus {
        name: "PDF / 中英文 OCR · macOS".into(),
        available: runtime.helper.is_file(),
        detail: "本地 PDFKit + Vision；无需上传文件".into(),
    });
    Ok(statuses)
}
#[tauri::command]
pub fn cancel_job(jobs: tauri::State<Jobs>, job_id: String) -> Result<()> {
    if let Some(sender) = jobs.active.lock().unwrap().get(&job_id) {
        let _ = sender.send(true);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn error_summary_keeps_final_diagnostic_without_discarding_only_error() {
        let noisy = format!("{}\n真实错误：未找到表格", "诊断".repeat(3000));
        let message = process_error_message(&noisy, "");
        assert!(message.ends_with("真实错误：未找到表格"));
        assert!(message.chars().count() <= 3000);
        assert_eq!(
            process_error_message("FutureWarning: deprecated\n未找到表格", ""),
            "未找到表格"
        );
        assert_eq!(
            process_error_message("Fontconfig warning: no cache", ""),
            "Fontconfig warning: no cache"
        );
        assert_eq!(process_error_message("", "真正错误"), "真正错误");
    }

    #[tokio::test]
    async fn cancelling_terminates_the_owned_process_group() {
        let (tx, rx) = watch::channel(false);
        let control = Control {
            receiver: rx,
            app: None,
            id: "cancel-test".into(),
        };
        let process =
            tokio::spawn(
                async move { run(Path::new("/bin/sleep"), &["30".into()], &control).await },
            );
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        tx.send(true).unwrap();
        let result = tokio::time::timeout(std::time::Duration::from_secs(2), process)
            .await
            .unwrap()
            .unwrap();
        assert!(result.unwrap_err().to_string().contains("取消"));
    }
}
