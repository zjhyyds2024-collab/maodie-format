use super::formats::*;
use super::runtime::Runtime;
use crate::error::{AppError, Result};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::AppHandle;
pub(super) fn input(path: &str) -> Result<PathBuf> {
    let path = fs::canonicalize(path).map_err(AppError::from)?;
    if !path.is_file() {
        return Err(AppError::UnsupportedFormat(
            "请选择文件，不能选择文件夹。".into(),
        ));
    }
    Ok(path)
}
#[derive(serde::Serialize)]
pub struct FileInfo {
    pub name: String,
    pub size_bytes: u64,
    pub extension: String,
    pub category: String,
    pub output_formats: Vec<String>,
}
#[tauri::command]
pub async fn get_file_info(app: AppHandle, path: String) -> Result<FileInfo> {
    let path = input(&path)?;
    let ext = source_extension(&path);
    let runtime = Runtime::from_app(&app)?;
    let raw = matches!(
        ext.as_str(),
        "dng"
            | "nef"
            | "cr2"
            | "cr3"
            | "crw"
            | "arw"
            | "raf"
            | "rw2"
            | "orf"
            | "pef"
            | "srw"
            | "3fr"
            | "erf"
            | "fff"
            | "iiq"
            | "kdc"
            | "mef"
            | "mrw"
            | "x3f"
    );
    let raw_available = if raw {
        tokio::process::Command::new(&runtime.magick)
            .args(["-list", "format"])
            .output()
            .await
            .ok()
            .filter(|o| o.status.success())
            .map(|o| {
                String::from_utf8_lossy(&o.stdout).lines().any(|line| {
                    let words: Vec<_> = line.split_whitespace().collect();
                    words.len() > 1
                        && words[0].trim_end_matches('*').eq_ignore_ascii_case(&ext)
                        && words[1].contains('r')
                })
            })
            .unwrap_or(false)
    } else {
        true
    };
    let formats = output_formats(&ext)
        .into_iter()
        .filter(|_| raw_available)
        .filter(|target| match category(&ext) {
            "archive" => {
                runtime.python.is_file()
                    && runtime.advanced.is_file()
                    && (*target != "pdf" || runtime.helper.is_file())
            }
            "image" => match *target {
                "pdf" | "txt" => runtime.helper.is_file(),
                "mp4" | "webm" => runtime.ffmpeg.is_file() && runtime.magick.is_file(),
                _ => runtime.magick.is_file(),
            },
            "audio" | "video" => {
                runtime.ffmpeg.is_file()
                    && (!encrypted_music(&ext)
                        || runtime.python.is_file()
                            && runtime.advanced.is_file()
                            && runtime
                                .advanced
                                .parent()
                                .unwrap()
                                .join("ncm_tools.py")
                                .is_file())
            }
            "pdf" => {
                if matches!(*target, "docx" | "xlsx" | "html") {
                    runtime.python.is_file() && runtime.advanced.is_file()
                } else {
                    runtime.helper.is_file()
                }
            }
            "document" => {
                let structured = structured_source(&ext)
                    || matches!(*target, "json" | "xml" | "yaml")
                    || *target == "csv" && !spreadsheet(&ext);
                if structured {
                    runtime.python.is_file()
                        && runtime.advanced.is_file()
                        && (matches!(
                            *target,
                            "json" | "xml" | "yaml" | "csv" | "txt" | "md" | "html"
                        ) || runtime.pandoc.is_file()
                            && (*target != "pdf" || runtime.office.is_file()))
                } else if office_input(&ext) {
                    runtime.office.is_file()
                        && (!matches!(*target, "md" | "txt" | "rst" | "epub" | "html")
                            || runtime.pandoc.is_file())
                } else {
                    runtime.pandoc.is_file() && (*target != "pdf" || runtime.office.is_file())
                }
            }
            _ => false,
        })
        .map(str::to_owned)
        .collect();
    Ok(FileInfo {
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into(),
        size_bytes: fs::metadata(&path)?.len(),
        category: category(&ext).into(),
        output_formats: formats,
        extension: ext,
    })
}
#[tauri::command]
pub async fn save_file(from: String, to: String) -> Result<()> {
    // The save dialog handles overwrite confirmation. Opening source first also rejects self-copy.
    let source = fs::canonicalize(&from)?;
    if fs::canonicalize(&to).ok().as_ref() == Some(&source) {
        return Err(AppError::ConversionFailed("目标路径与源文件相同。".into()));
    }
    fs::copy(&source, &to)?;
    Ok(())
}
#[tauri::command]
pub async fn save_to_directory(
    from: String,
    directory: String,
    filename: String,
) -> Result<String> {
    let name = Path::new(&filename);
    if name.components().count() != 1 || filename == "." || filename == ".." {
        return Err(AppError::ConversionFailed("输出文件名无效。".into()));
    }
    let directory = fs::canonicalize(directory)?;
    if !directory.is_dir() {
        return Err(AppError::ConversionFailed("请选择输出文件夹。".into()));
    }
    let source_path = fs::canonicalize(&from)?;
    if source_path.is_dir() {
        if directory.starts_with(&source_path) {
            return Err(AppError::ConversionFailed(
                "不能将解压结果保存到它自身的子目录。".into(),
            ));
        }
        for n in 0..10000 {
            let candidate = directory.join(if n == 0 {
                filename.clone()
            } else {
                format!("{filename} ({n})")
            });
            match fs::create_dir(&candidate) {
                Ok(()) => {
                    if let Err(error) = copy_directory(&source_path, &candidate) {
                        let _ = fs::remove_dir_all(&candidate);
                        return Err(error);
                    }
                    return Ok(candidate.to_string_lossy().into());
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(error.into()),
            }
        }
        return Err(AppError::ConversionFailed("同名文件夹过多。".into()));
    }
    let stem = name.file_stem().unwrap_or_default().to_string_lossy();
    let ext = extension(name);
    let mut source = fs::File::open(from)?;
    for n in 0..10000 {
        let candidate = if n == 0 {
            directory.join(&filename)
        } else {
            directory.join(format!(
                "{stem} ({n}){}",
                if ext.is_empty() {
                    String::new()
                } else {
                    format!(".{ext}")
                }
            ))
        };
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
        {
            Ok(mut file) => {
                if let Err(e) = std::io::copy(&mut source, &mut file) {
                    drop(file);
                    let _ = fs::remove_file(&candidate);
                    return Err(e.into());
                }
                return Ok(candidate.to_string_lossy().into());
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e.into()),
        }
    }
    Err(AppError::ConversionFailed(
        "同名文件过多，请选择其他文件夹。".into(),
    ))
}
fn copy_directory(source: &Path, destination: &Path) -> Result<()> {
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let kind = entry.file_type()?;
        let target = destination.join(entry.file_name());
        if kind.is_symlink() {
            return Err(AppError::ConversionFailed(
                "文件夹包含符号链接，已停止保存。".into(),
            ));
        }
        if kind.is_dir() {
            fs::create_dir(&target)?;
            copy_directory(&entry.path(), &target)?;
        } else {
            let mut from = fs::File::open(entry.path())?;
            let mut to = fs::OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(target)?;
            std::io::copy(&mut from, &mut to)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn reveal_file(path: String) -> Result<()> {
    let path = fs::canonicalize(path)?;
    tokio::process::Command::new("/usr/bin/open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map_err(AppError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn expand_input_paths(paths: Vec<String>) -> Result<Vec<String>> {
    tokio::task::spawn_blocking(move || expand_paths(&paths))
        .await
        .map_err(|e| AppError::Io(e.to_string()))?
}

fn expand_paths(paths: &[String]) -> Result<Vec<String>> {
    use std::collections::BTreeSet;
    let mut files = BTreeSet::new();
    let mut stack: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    let mut visited = 0;
    while let Some(path) = stack.pop() {
        visited += 1;
        if visited > 20000 || files.len() > 1000 {
            return Err(AppError::UnsupportedFormat(
                "一次最多添加 1000 个文件，请选择更小的文件夹。".into(),
            ));
        }
        let meta = fs::symlink_metadata(&path)?;
        if meta.file_type().is_symlink() {
            continue;
        }
        if meta.is_dir() {
            for entry in fs::read_dir(&path)? {
                let child = entry?;
                if child.file_name().to_string_lossy().starts_with('.') {
                    continue;
                }
                let kind = child.file_type()?;
                if kind.is_symlink() {
                    continue;
                }
                if kind.is_dir()
                    || kind.is_file() && category(&source_extension(&child.path())) != "unknown"
                {
                    stack.push(child.path());
                }
                if stack.len() > 20000 {
                    return Err(AppError::UnsupportedFormat(
                        "文件夹过大，请分批添加。".into(),
                    ));
                }
            }
        } else if meta.is_file() {
            files.insert(fs::canonicalize(path)?.to_string_lossy().into_owned());
        }
    }
    if files.len() > 1000 {
        return Err(AppError::UnsupportedFormat(
            "一次最多添加 1000 个文件，请分批添加。".into(),
        ));
    }
    Ok(files.into_iter().collect())
}

#[cfg(test)]
mod folder_tests {
    use super::*;
    #[test]
    fn expands_supported_files_without_symlinks_or_duplicates() {
        let root = tempfile::tempdir().unwrap();
        let nested = root.path().join("nested");
        fs::create_dir(&nested).unwrap();
        fs::write(root.path().join("one.qmc0"), b"fixture").unwrap();
        fs::write(nested.join("two.ncm"), b"fixture").unwrap();
        fs::write(nested.join("skip.lrc"), b"lyrics").unwrap();
        std::os::unix::fs::symlink(root.path(), nested.join("loop")).unwrap();
        let result = expand_paths(&[
            root.path().to_string_lossy().into(),
            root.path().join("one.qmc0").to_string_lossy().into(),
        ])
        .unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().any(|p| p.ends_with("two.ncm")));
    }
}
