use super::file_ops::input;
use super::formats::*;
use super::runtime::{run, run_with_env, Control, Jobs, Runtime};
use crate::error::{AppError, Result};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, State};
use tokio::sync::watch;
use uuid::Uuid;

#[derive(Debug, serde::Deserialize, Default)]
pub struct ConvertOptions {
    pub quality: Option<u8>,
    pub audio_bitrate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub preserve_metadata: Option<bool>,
    pub music_ekey: Option<String>,
    pub music_key_db: Option<String>,
}
#[derive(Debug, serde::Deserialize)]
pub struct ConvertRequest {
    pub input_path: String,
    pub output_format: String,
    #[serde(default)]
    pub options: ConvertOptions,
    pub job_id: Option<String>,
}
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ConvertResult {
    pub output_path: String,
    pub size_bytes: u64,
    pub warnings: Vec<String>,
    pub is_directory: bool,
    pub output_extension: String,
}
#[derive(serde::Deserialize)]
pub struct ToolRequest {
    pub operation: String,
    pub input_paths: Vec<String>,
    pub pages: Option<String>,
    pub group_size: Option<u32>,
    pub job_id: String,
    pub password: Option<String>,
    pub rotation: Option<u16>,
}

fn result(path: &Path, warnings: Vec<String>) -> Result<ConvertResult> {
    let meta = fs::metadata(path).map_err(AppError::from)?;
    if !meta.is_file() || meta.len() == 0 {
        return Err(AppError::ConversionFailed(
            "转换引擎没有生成有效文件。".into(),
        ));
    }
    Ok(ConvertResult {
        output_path: path.to_string_lossy().into(),
        size_bytes: meta.len(),
        warnings,
        is_directory: false,
        output_extension: extension(path),
    })
}
fn begin(jobs: &Jobs, app: &AppHandle, id: &str) -> Result<Control> {
    let (sender, receiver) = watch::channel(false);
    let mut active = jobs.active.lock().unwrap();
    if active.contains_key(id) {
        return Err(AppError::ProcessError("任务已经在运行。".into()));
    }
    active.insert(id.to_owned(), sender);
    Ok(Control {
        receiver,
        app: Some(app.clone()),
        id: id.to_owned(),
    })
}
fn strings(values: &[&str]) -> Vec<String> {
    values.iter().map(|s| s.to_string()).collect()
}

pub async fn native_tool(
    runtime: &Runtime,
    operation: &str,
    paths: &[PathBuf],
    out: &Path,
    pages: Option<&str>,
    group_size: Option<u32>,
    control: &Control,
) -> Result<Vec<String>> {
    control.stage("正在处理文档");
    let request = serde_json::json!({"operation":operation,"input_paths":paths,"output_path":out,"pages":pages,"group_size":group_size});
    let stdout = run(&runtime.helper, &[request.to_string()], control).await?;
    let value: serde_json::Value = serde_json::from_str(stdout.lines().last().unwrap_or("{}"))
        .map_err(|e| AppError::ConversionFailed(e.to_string()))?;
    let outputs = value["outputs"]
        .as_array()
        .ok_or_else(|| AppError::ConversionFailed("文档组件返回结果不完整。".into()))?;
    if outputs.is_empty() {
        return Err(AppError::ConversionFailed("没有生成输出文件。".into()));
    }
    Ok(value["warnings"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default())
}
async fn office(
    runtime: &Runtime,
    source: &Path,
    out: &Path,
    work: &Path,
    control: &Control,
) -> Result<()> {
    control.stage("正在转换 Office 文档");
    let office_out = work.join(Uuid::new_v4().to_string());
    fs::create_dir(&office_out)?;
    let profile = work.join(format!("profile-{}", Uuid::new_v4()));
    let profile_url = format!(
        "file://{}",
        profile
            .to_string_lossy()
            .replace('%', "%25")
            .replace(' ', "%20")
            .replace('#', "%23")
            .replace('?', "%3F")
    );
    let format = if extension(out) == "csv" {
        "csv:Text - txt - csv (StarCalc):44,34,76,1".to_string()
    } else {
        extension(out)
    };
    let mut args = vec![format!("-env:UserInstallation={profile_url}")];
    args.extend(strings(&[
        "--headless",
        "--norestore",
        "--nodefault",
        "--nofirststartwizard",
    ]));
    if extension(source) == "csv" {
        args.push("--infilter=Text - txt - csv (StarCalc):44,34,76,1".into());
    }
    args.extend(vec![
        "--convert-to".into(),
        format,
        "--outdir".into(),
        office_out.to_string_lossy().into(),
        source.to_string_lossy().into(),
    ]);
    if !runtime.fontconfig.is_file() {
        return Err(AppError::SidecarNotFound(
            "缺少 macOS 字体配置，请重新安装应用。".into(),
        ));
    }
    // Restrict font discovery to the child process; do not change the user's
    // global environment. Headless fallback otherwise misses macOS CJK fonts.
    run_with_env(
        &runtime.office,
        &args,
        control,
        &[("FONTCONFIG_FILE", runtime.fontconfig.as_os_str())],
    )
    .await?;
    let created = fs::read_dir(&office_out)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| extension(p) == extension(out))
        .ok_or_else(|| {
            AppError::ConversionFailed(
                "LibreOffice 未生成目标文件，此文件可能损坏、加密或格式不兼容。".into(),
            )
        })?;
    if extension(out) == "html" && presentation(&extension(source)) {
        let main_name = created.file_name().unwrap().to_owned();
        for entry in fs::read_dir(&office_out)? {
            let entry = entry?;
            fs::rename(entry.path(), out.parent().unwrap().join(entry.file_name()))?;
        }
        let original = out.parent().unwrap().join(main_name);
        if original != out {
            fs::copy(original, out)?;
        }
    } else if extension(out) == "html" {
        run(
            &runtime.pandoc,
            &[
                created.to_string_lossy().into(),
                "--standalone".into(),
                "--embed-resources".into(),
                format!("--resource-path={}", office_out.display()),
                "-o".into(),
                out.to_string_lossy().into(),
            ],
            control,
        )
        .await?;
    } else {
        fs::rename(created, out)?;
    }
    Ok(())
}
fn remux_codecs_fit(target: &str, video: Option<&str>, audio: Option<&str>) -> bool {
    if target == "mkv" {
        return true;
    }
    let video_ok = video.map_or(true, |codec| match target {
        "ts" => ["h264", "hevc", "mpeg2video"].contains(&codec),
        _ => ["h264", "hevc", "mpeg4"].contains(&codec),
    });
    let audio_ok = audio.map_or(true, |codec| match target {
        "ts" => ["aac", "mp2", "mp3", "ac3", "eac3"].contains(&codec),
        _ => ["aac", "mp3", "alac"].contains(&codec),
    });
    video_ok && audio_ok
}

async fn can_copy_streams(
    runtime: &Runtime,
    source: &Path,
    target: &str,
    control: &Control,
) -> bool {
    let probe = runtime
        .ffmpeg
        .parent()
        .unwrap_or(Path::new(""))
        .join("ffprobe");
    let args = vec![
        "-v".into(),
        "error".into(),
        "-show_entries".into(),
        "stream=codec_type,codec_name:stream_disposition=attached_pic".into(),
        "-of".into(),
        "json".into(),
        source.to_string_lossy().into_owned(),
    ];
    let Ok(raw) = run(&probe, &args, control).await else {
        return false;
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return false;
    };
    let Some(streams) = value["streams"].as_array() else {
        return false;
    };
    let codec = |kind: &str| {
        streams
            .iter()
            .find(|s| {
                s["codec_type"] == kind
                    && s["disposition"]["attached_pic"].as_u64().unwrap_or(0) == 0
            })
            .and_then(|s| s["codec_name"].as_str())
    };
    remux_codecs_fit(target, codec("video"), codec("audio"))
}

pub async fn convert(
    runtime: &Runtime,
    request: &ConvertRequest,
    output_dir: &Path,
    control: &Control,
) -> Result<ConvertResult> {
    let source = input(&request.input_path)?;
    let ext = source_extension(&source);
    let target = request.output_format.to_lowercase();
    if !output_formats(&ext).contains(&target.as_str()) {
        return Err(AppError::UnsupportedFormat(format!(
            "不支持 {ext} → {target}"
        )));
    }
    fs::create_dir_all(output_dir)?;
    let scratch = tempfile::tempdir_in(output_dir)?;
    let packed = (presentation(&ext) || ext == "pdf") && matches!(target.as_str(), "png" | "jpg")
        || presentation(&ext) && target == "html";
    let actual_target = if packed { "zip" } else { &target };
    let out = output_dir.join(format!("result.{actual_target}"));
    let opts = &request.options;
    let mut warnings = vec![];
    control.stage("正在转换，无法预估总进度");
    if matches!(
        ext.as_str(),
        "wps" | "wpt" | "et" | "ett" | "dps" | "dpt" | "wpd"
    ) {
        warnings.push("兼容性导入，尚未验证所有变体，请核对内容与排版。".into());
    }
    if ext == "xlsm" {
        warnings.push("导出格式不保留 VBA 宏，请保留原始 XLSM 文件。".into());
    }
    let mut media_source = source.clone();
    let mut media_tags = None;
    let mut media_cover = None;
    if encrypted_music(&ext) {
        control.stage("正在读取加密音乐");
        let (paths, notes) = advanced_request(
            runtime,
            if ext == "ncm" {
                "decode-ncm"
            } else {
                "decode-music"
            },
            &[source.clone()],
            &scratch.path().join("music"),
            None,
            serde_json::json!({"music_ekey":opts.music_ekey,"music_key_db":opts.music_key_db}),
            control,
        )
        .await?;
        warnings.extend(notes);
        media_source = PathBuf::from(
            paths
                .first()
                .ok_or_else(|| AppError::ConversionFailed("NCM 没有生成音频。".into()))?,
        );
        media_tags = if ext == "ncm" {
            paths.get(1).map(PathBuf::from)
        } else {
            None
        };
        media_cover = paths.get(2).map(PathBuf::from);
        if target == "restore-audio" {
            let restored = output_dir.join(format!("result.{}", extension(&media_source)));
            let mut args = strings(&["-hide_banner", "-loglevel", "error", "-nostdin", "-i"]);
            args.push(media_source.to_string_lossy().into());
            if opts.preserve_metadata.unwrap_or(true) {
                if let Some(tags) = &media_tags {
                    args.extend(strings(&["-f", "ffmetadata", "-i"]));
                    args.push(tags.to_string_lossy().into());
                    args.extend(strings(&["-map_metadata", "1"]));
                }
            } else {
                args.extend(strings(&["-map_metadata", "-1"]));
            }
            args.extend(strings(&["-map", "0:a:0", "-c:a", "copy", "-y"]));
            args.push(restored.to_string_lossy().into());
            run(&runtime.ffmpeg, &args, control).await?;
            if opts.preserve_metadata.unwrap_or(true) {
                if let Some(cover) = &media_cover {
                    warnings.extend(
                        advanced(
                            runtime,
                            "music-cover",
                            &[cover.clone()],
                            &restored,
                            None,
                            control,
                        )
                        .await?
                        .1,
                    );
                }
            }
            warnings.push("已还原原始音频，保留源音频编码，未重新编码。".into());
            return result(&restored, warnings);
        }
        warnings.push("加密音乐已读取，正按所选格式转码；选择还原原始音频可避免重新编码。".into());
    }
    match category(&ext) {
        "archive" => {
            let unpacked = if target == "unpack" {
                output_dir.join("unpacked")
            } else {
                scratch.path().join("unpacked")
            };
            let (paths, notes) =
                advanced(runtime, "extract-zip", &[source], &unpacked, None, control).await?;
            warnings.extend(notes);
            if target == "unpack" {
                return directory_result(&unpacked, warnings);
            }
            let mut images: Vec<PathBuf> = paths
                .into_iter()
                .map(PathBuf::from)
                .filter(|p| {
                    category(&extension(p)) == "image"
                        && !p.components().any(|c| c.as_os_str() == "__MACOSX")
                        && !p
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .starts_with("._")
                })
                .collect();
            images.sort_by(|a, b| natural_key(a).cmp(&natural_key(b)));
            if images.is_empty() {
                return Err(AppError::ConversionFailed(
                    "ZIP 中没有可识别的图片。".into(),
                ));
            }
            let mut normalized = vec![];
            for image in images {
                normalized.push(normalize_image(runtime, &image, scratch.path(), control).await?);
            }
            warnings.extend(
                native_tool(
                    runtime,
                    "images-pdf",
                    &normalized,
                    &out,
                    None,
                    None,
                    control,
                )
                .await?,
            );
        }
        "pdf" if matches!(target.as_str(), "docx" | "xlsx" | "html") => {
            warnings.extend(
                advanced(runtime, "pdf-office", &[source], &out, None, control)
                    .await?
                    .1,
            );
        }
        "pdf" if packed => {
            let pages = scratch.path().join("pages");
            warnings.extend(native_pages(runtime, &source, &pages, &target, None, control).await?);
            pack(&pages, &out, control).await?;
        }
        "pdf" => {
            warnings.extend(
                native_tool(runtime, "pdf-text", &[source], &out, None, None, control).await?,
            );
        }
        "image" => match target.as_str() {
            "pdf" => {
                let image = normalize_image(runtime, &source, scratch.path(), control).await?;
                warnings.extend(
                    native_tool(runtime, "images-pdf", &[image], &out, None, None, control).await?,
                );
            }
            "txt" => {
                let image = normalize_image(runtime, &source, scratch.path(), control).await?;
                warnings.extend(
                    native_tool(runtime, "ocr", &[image], &out, None, None, control).await?,
                );
            }
            "mp4" | "webm" => {
                let normalized = scratch.path().join("image.png");
                run(
                    &runtime.magick,
                    &[
                        source.to_string_lossy().into(),
                        normalized.to_string_lossy().into(),
                    ],
                    control,
                )
                .await?;
                let mut args = strings(&[
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-nostdin",
                    "-loop",
                    "1",
                    "-i",
                    &normalized.to_string_lossy(),
                    "-t",
                    "3",
                    "-vf",
                    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                    "-pix_fmt",
                    "yuv420p",
                    "-y",
                ]);
                args.push(out.to_string_lossy().into());
                run(&runtime.ffmpeg, &args, control).await?;
                warnings.push("单张图片已生成 3 秒静态视频。".into());
            }
            _ => {
                // Layered PSDs and multi-size ICOs otherwise produce result-0.png,
                // result-1.png, ... while this route promises one output file.
                let single_frame = ext == "ico"
                    || ext == "psd" && target != "psd"
                    || !matches!(target.as_str(), "gif" | "webp" | "tiff" | "ico" | "psd");
                let image_input = if single_frame {
                    if ext == "psd" {
                        warnings.push("已导出 PSD 合成图，不保留可编辑图层。".into());
                    } else if ext == "ico" {
                        warnings.push("已使用 ICO 中的首个图标尺寸。".into());
                    } else if matches!(ext.as_str(), "gif" | "tif" | "tiff" | "webp") {
                        let frames = run(
                            &runtime.magick,
                            &[
                                "identify".into(),
                                "-ping".into(),
                                "-format".into(),
                                "%n\n".into(),
                                source.to_string_lossy().into_owned(),
                            ],
                            control,
                        )
                        .await?;
                        if frames
                            .lines()
                            .next()
                            .and_then(|n| n.parse::<usize>().ok())
                            .unwrap_or(1)
                            > 1
                        {
                            warnings.push("目标格式为单张图片，仅导出首帧或第一页。".into());
                        }
                    }
                    format!("{}[0]", source.display())
                } else {
                    source.to_string_lossy().into_owned()
                };
                let mut args = vec![image_input, "-auto-orient".into()];
                if target == "ico" {
                    // ICO entries are at most 256 px and square. Fit without stretching,
                    // then pad transparently before creating the standard icon sizes.
                    args.extend(strings(&[
                        "-thumbnail",
                        "256x256>",
                        "-background",
                        "none",
                        "-gravity",
                        "center",
                        "-extent",
                        "256x256",
                        "-define",
                        "icon:auto-resize=256,128,64,48,32,16",
                    ]));
                }
                args.extend(vec![
                    "-quality".into(),
                    opts.quality.unwrap_or(92).clamp(1, 100).to_string(),
                    out.to_string_lossy().into_owned(),
                ]);
                run(&runtime.magick, &args, control).await?;
            }
        },
        "audio" | "video" => {
            let mut args = strings(&["-hide_banner", "-loglevel", "error", "-nostdin", "-i"]);
            args.push(media_source.to_string_lossy().into());
            if opts.preserve_metadata.unwrap_or(true) {
                if let Some(tags) = &media_tags {
                    args.extend(strings(&["-f", "ffmetadata", "-i"]));
                    args.push(tags.to_string_lossy().into());
                    args.extend(strings(&["-map_metadata", "1"]));
                } else {
                    args.extend(strings(&["-map_metadata", "0"]));
                }
            } else {
                args.extend(strings(&["-map_metadata", "-1"]));
            }
            args.extend(strings(&["-y", "-threads", "4"]));
            if category(&target) == "audio" {
                args.push("-vn".into());
                if let Some(bitrate) = opts.audio_bitrate {
                    args.extend(vec!["-b:a".into(), format!("{}k", bitrate.clamp(32, 512))]);
                }
                if let Some(rate) = opts.sample_rate.filter(|rate| *rate > 0) {
                    let rate = rate.clamp(8000, 192000);
                    let effective = if target == "opus"
                        && ![8000, 12000, 16000, 24000, 48000].contains(&rate)
                    {
                        warnings.push(format!("Opus 不支持 {rate} Hz，已使用 48000 Hz。"));
                        48000
                    } else {
                        rate
                    };
                    args.extend(vec!["-ar".into(), effective.to_string()]);
                }
                args.push(out.to_string_lossy().into());
                run(&runtime.ffmpeg, &args, control).await?;
            } else {
                args.extend(strings(&["-map", "0:V:0?", "-map", "0:a:0?"]));
                let can_remux = matches!(target.as_str(), "mkv" | "mp4" | "mov" | "m4v" | "ts");
                let mut copied = false;
                if can_remux && can_copy_streams(runtime, &source, &target, control).await {
                    let mut copy_args = args.clone();
                    copy_args.extend(strings(&["-c", "copy"]));
                    copy_args.push(out.to_string_lossy().into());
                    match run(&runtime.ffmpeg, &copy_args, control).await {
                        Ok(_) => {
                            copied = true;
                            warnings.push(
                                "已直接封装，保留源音视频编码；播放器兼容性取决于源编码。".into(),
                            );
                        }
                        Err(_) => {
                            control.check()?;
                        }
                    }
                }
                if !copied {
                    let codecs: &[&str] = match target.as_str() {
                        "mp4" | "mov" | "m4v" | "mkv" | "ts" | "3gp" => {
                            &["-c:v", "libx264", "-c:a", "aac"]
                        }
                        "webm" => &["-c:v", "libvpx-vp9", "-c:a", "libopus"],
                        "avi" => &["-c:v", "mpeg4", "-c:a", "libmp3lame"],
                        "wmv" => &["-c:v", "msmpeg4v3", "-c:a", "wmav2"],
                        "ogv" => &["-c:v", "libvpx", "-c:a", "libvorbis"],
                        "flv" => &["-c:v", "flv", "-c:a", "libmp3lame"],
                        "gif" => &["-an"],
                        _ => &[],
                    };
                    args.extend(strings(codecs));
                    args.push(out.to_string_lossy().into());
                    run(&runtime.ffmpeg, &args, control).await?;
                    if can_remux {
                        warnings
                            .push("未直接封装，已使用 H.264/AAC 重新编码以兼容目标容器。".into());
                    }
                }
            }
        }
        "document" => {
            if presentation(&ext) && packed {
                if target == "html" {
                    let html_dir = scratch.path().join("html");
                    fs::create_dir(&html_dir)?;
                    let html = html_dir.join("slides.html");
                    office(runtime, &source, &html, scratch.path(), control).await?;
                    pack(&html_dir, &out, control).await?;
                    warnings.push("演示文稿已导出 HTML 网页包（ZIP），请解压后打开 HTML。".into());
                } else {
                    let pdf = scratch.path().join("slides.pdf");
                    office(runtime, &source, &pdf, scratch.path(), control).await?;
                    let pages = scratch.path().join("pages");
                    warnings
                        .extend(native_pages(runtime, &pdf, &pages, &target, None, control).await?);
                    pack(&pages, &out, control).await?;
                }
            } else if spreadsheet(&ext) && target == "html" {
                let html = scratch.path().join("table.html");
                office(runtime, &source, &html, scratch.path(), control).await?;
                // LibreOffice's single-file Calc HTML embeds formatting; include any exported media in a web archive only when present.
                fs::copy(&html, &out)?;
            } else if matches!(target.as_str(), "json" | "xml" | "yaml" | "csv")
                && !spreadsheet(&ext)
                || ext == "csv" && matches!(target.as_str(), "json" | "xml" | "yaml" | "txt" | "md")
                || structured_source(&ext)
            {
                if matches!(
                    target.as_str(),
                    "json" | "xml" | "yaml" | "csv" | "txt" | "md" | "html"
                ) {
                    warnings.extend(
                        advanced(runtime, "structured", &[source], &out, None, control)
                            .await?
                            .1,
                    );
                } else {
                    let normalized = scratch.path().join("normalized").join(format!(
                        "{}.html",
                        source.file_stem().unwrap_or_default().to_string_lossy()
                    ));
                    fs::create_dir_all(normalized.parent().unwrap())?;
                    warnings.extend(
                        advanced(runtime, "structured", &[source], &normalized, None, control)
                            .await?
                            .1,
                    );
                    pandoc_document(runtime, &normalized, &out, scratch.path(), control).await?;
                }
            } else if ext == "csv" && matches!(target.as_str(), "docx" | "epub") {
                let html = scratch.path().join("normalized").join(format!(
                    "{}.html",
                    source.file_stem().unwrap_or_default().to_string_lossy()
                ));
                fs::create_dir_all(html.parent().unwrap())?;
                warnings.extend(
                    advanced(runtime, "structured", &[source], &html, None, control)
                        .await?
                        .1,
                );
                pandoc_document(runtime, &html, &out, scratch.path(), control).await?;
            } else if office_input(&ext)
                && matches!(
                    target.as_str(),
                    "docx"
                        | "odt"
                        | "rtf"
                        | "pdf"
                        | "xlsx"
                        | "xls"
                        | "ods"
                        | "csv"
                        | "pptx"
                        | "odp"
                )
            {
                if target == "csv" && ext != "csv" {
                    warnings.push("CSV 只保存一个工作表，不保留样式。".into());
                }
                office(runtime, &source, &out, scratch.path(), control).await?;
            } else {
                let normalized = if matches!(ext.as_str(), "doc" | "wps" | "wpt" | "wpd") {
                    let temp = scratch.path().join("source.docx");
                    office(runtime, &source, &temp, scratch.path(), control).await?;
                    temp
                } else {
                    source.clone()
                };
                pandoc_document(runtime, &normalized, &out, scratch.path(), control).await?;
                if matches!(target.as_str(), "md" | "rst") && office_input(&ext) {
                    warnings.push("文本格式不完整保留文档内嵌图片及复杂版式，请核对结果。".into());
                }
            }
        }
        _ => return Err(AppError::UnsupportedFormat(ext)),
    }
    control.check()?;
    if opts.preserve_metadata.unwrap_or(true) {
        if let Some(cover) = media_cover {
            warnings.extend(
                advanced(runtime, "music-cover", &[cover], &out, None, control)
                    .await?
                    .1,
            );
        }
    }
    result(&out, warnings)
}

async fn normalize_image(
    runtime: &Runtime,
    source: &Path,
    work: &Path,
    control: &Control,
) -> Result<PathBuf> {
    if matches!(
        extension(source).as_str(),
        "png" | "jpg" | "jpeg" | "bmp" | "tif" | "tiff" | "heic" | "heif"
    ) {
        return Ok(source.to_owned());
    }
    let out = work.join(format!("{}.png", Uuid::new_v4()));
    run(
        &runtime.magick,
        &[
            format!("{}[0]", source.display()),
            out.to_string_lossy().into(),
        ],
        control,
    )
    .await?;
    Ok(out)
}

async fn pandoc_document(
    runtime: &Runtime,
    source: &Path,
    out: &Path,
    work: &Path,
    control: &Control,
) -> Result<()> {
    let target = extension(out);
    let input = if matches!(extension(source).as_str(), "txt" | "log") {
        let normalized = work.join("plain-text.html");
        advanced(
            runtime,
            "structured",
            &[source.to_path_buf()],
            &normalized,
            None,
            control,
        )
        .await?;
        normalized
    } else {
        source.to_path_buf()
    };
    let html = work.join("document.html");
    let destination = if target == "pdf" { &html } else { out };
    let mut args = vec![
        input.to_string_lossy().into(),
        "-o".into(),
        destination.to_string_lossy().into(),
        format!("--resource-path={}", source.parent().unwrap().display()),
    ];
    if target == "txt" {
        args.extend(strings(&["-t", "plain"]));
    }
    if target == "epub" {
        args.push("--epub-title-page=false".into());
    }
    if target == "html" || target == "pdf" {
        args.extend(strings(&["--embed-resources", "--standalone"]));
    }
    run(&runtime.pandoc, &args, control).await?;
    if target == "pdf" {
        office(runtime, &html, out, work, control).await?;
    }
    Ok(())
}
fn natural_key(path: &Path) -> String {
    let mut key = String::new();
    let mut digits = String::new();
    for c in path.to_string_lossy().to_lowercase().chars() {
        if c.is_ascii_digit() {
            digits.push(c);
        } else {
            if !digits.is_empty() {
                key.push_str(&format!("{:0>20}", digits));
                digits.clear();
            }
            key.push(c);
        }
    }
    if !digits.is_empty() {
        key.push_str(&format!("{:0>20}", digits));
    }
    key
}
pub async fn advanced(
    runtime: &Runtime,
    operation: &str,
    paths: &[PathBuf],
    out: &Path,
    password: Option<&str>,
    control: &Control,
) -> Result<(Vec<String>, Vec<String>)> {
    advanced_request(
        runtime,
        operation,
        paths,
        out,
        password,
        serde_json::json!({}),
        control,
    )
    .await
}
async fn advanced_request(
    runtime: &Runtime,
    operation: &str,
    paths: &[PathBuf],
    out: &Path,
    password: Option<&str>,
    extra: serde_json::Value,
    control: &Control,
) -> Result<(Vec<String>, Vec<String>)> {
    use std::io::Write;
    let mut request = tempfile::NamedTempFile::new_in(out.parent().unwrap())?;
    let mut value = serde_json::json!({"operation":operation,"input_paths":paths,"output_path":out,"password":password,"native_helper":runtime.helper});
    if let Some(extra) = extra.as_object() {
        for key in ["pages", "rotation", "music_ekey", "music_key_db"] {
            if let Some(field) = extra.get(key) {
                value[key] = field.clone();
            }
        }
    }
    request.write_all(value.to_string().as_bytes())?;
    request.flush()?;
    let stdout = run(
        &runtime.python,
        &[
            runtime.advanced.to_string_lossy().into(),
            request.path().to_string_lossy().into(),
        ],
        control,
    )
    .await?;
    let value: serde_json::Value = serde_json::from_str(stdout.lines().last().unwrap_or("{}"))
        .map_err(|e| AppError::ConversionFailed(e.to_string()))?;
    let outputs = value["outputs"]
        .as_array()
        .ok_or_else(|| AppError::ConversionFailed("扩展组件返回结果不完整。".into()))?
        .iter()
        .filter_map(|v| v.as_str().map(str::to_owned))
        .collect();
    let warnings = value["warnings"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();
    Ok((outputs, warnings))
}
async fn pack(source: &Path, out: &Path, control: &Control) -> Result<()> {
    run(
        Path::new("/usr/bin/ditto"),
        &strings(&[
            "-c",
            "-k",
            "--norsrc",
            "--noextattr",
            "--keepParent",
            &source.to_string_lossy(),
            &out.to_string_lossy(),
        ]),
        control,
    )
    .await?;
    Ok(())
}
async fn native_pages(
    runtime: &Runtime,
    source: &Path,
    out: &Path,
    format: &str,
    pages: Option<&str>,
    control: &Control,
) -> Result<Vec<String>> {
    let request = serde_json::json!({"operation":"pdf-images","input_paths":[source],"output_path":out,"image_format":format,"pages":pages});
    let stdout = run(&runtime.helper, &[request.to_string()], control).await?;
    let value: serde_json::Value = serde_json::from_str(stdout.lines().last().unwrap_or("{}"))
        .map_err(|e| AppError::ConversionFailed(e.to_string()))?;
    Ok(value["warnings"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default())
}
fn directory_size(path: &Path) -> Result<u64> {
    let mut size = 0;
    for item in fs::read_dir(path)? {
        let entry = item?;
        let meta = entry.file_type()?;
        if meta.is_symlink() {
            return Err(AppError::ConversionFailed("输出目录包含符号链接。".into()));
        }
        size += if meta.is_dir() {
            directory_size(&entry.path())?
        } else {
            entry.metadata()?.len()
        };
    }
    Ok(size)
}
fn directory_result(path: &Path, warnings: Vec<String>) -> Result<ConvertResult> {
    Ok(ConvertResult {
        output_path: path.to_string_lossy().into(),
        size_bytes: directory_size(path)?,
        warnings,
        is_directory: true,
        output_extension: String::new(),
    })
}

#[tauri::command]
pub async fn convert_file(
    app: AppHandle,
    jobs: State<'_, Jobs>,
    request: ConvertRequest,
) -> Result<ConvertResult> {
    let id = request
        .job_id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let control = begin(&jobs, &app, &id)?;
    let dir = jobs.results.path().join(Uuid::new_v4().to_string());
    let output = match Runtime::from_app(&app) {
        Ok(runtime) => convert(&runtime, &request, &dir, &control).await,
        Err(e) => Err(e),
    };
    jobs.active.lock().unwrap().remove(&id);
    if output.is_err() {
        let _ = fs::remove_dir_all(&dir);
    }
    output
}
#[tauri::command]
pub async fn document_tool(
    app: AppHandle,
    jobs: State<'_, Jobs>,
    request: ToolRequest,
) -> Result<ConvertResult> {
    let control = begin(&jobs, &app, &request.job_id)?;
    let dir = jobs.results.path().join(Uuid::new_v4().to_string());
    let output = async {
        let op = request.operation.as_str();
        if !matches!(
            op,
            "merge-pdf"
                | "images-pdf"
                | "split-pdf"
                | "pdf-images"
                | "pdf-jpg"
                | "pdf-text"
                | "ocr"
                | "pdf-docx"
                | "pdf-xlsx"
                | "pdf-html"
                | "rotate-pdf" | "extract-pages" | "delete-pages" | "reorder-pages"
                | "decrypt-pdf"
                | "create-zip"
                | "create-7z"
                | "create-tar"
                | "create-tgz"
                | "create-tbz2"
                | "create-txz"
                | "extract-zip"
                | "zip-images-pdf"
        ) {
            return Err(AppError::UnsupportedFormat(request.operation.clone()));
        }
        if request.input_paths.is_empty() {
            return Err(AppError::UnsupportedFormat("请添加文件。".into()));
        }
        if !matches!(
            op,
            "merge-pdf"
                | "images-pdf"
                | "create-zip"
                | "create-7z"
                | "create-tar"
                | "create-tgz"
                | "create-tbz2"
                | "create-txz"
        ) && request.input_paths.len() != 1
        {
            return Err(AppError::UnsupportedFormat(
                "此工具每个任务处理一个文件。".into(),
            ));
        }
        let mut paths: Vec<PathBuf> = request
            .input_paths
            .iter()
            .map(|p| input(p))
            .collect::<Result<_>>()?;
        for path in &paths {
            let ext = extension(path);
            let valid = match op {
                "create-zip" | "create-7z" | "create-tar" | "create-tgz" | "create-tbz2"
                | "create-txz" => true,
                "extract-zip" => category(&ext) == "archive",
                "zip-images-pdf" => ext == "zip",
                "images-pdf" => category(&ext) == "image",
                "ocr" => ext == "pdf" || category(&ext) == "image",
                _ => ext == "pdf",
            };
            if !valid {
                return Err(AppError::UnsupportedFormat(format!(
                    "此工具不接受 {}",
                    path.display()
                )));
            }
        }
        fs::create_dir_all(&dir)?;
        let runtime = Runtime::from_app(&app)?;
        let image_work = tempfile::tempdir_in(&dir)?;
        if op == "images-pdf" || op == "ocr" && extension(&paths[0]) != "pdf" {
            let mut normalized = vec![];
            for path in paths {
                normalized
                    .push(normalize_image(&runtime, &path, image_work.path(), &control).await?);
            }
            paths = normalized;
        }

        if matches!(op, "rotate-pdf" | "extract-pages" | "delete-pages" | "reorder-pages") {
            let out = dir.join("result.pdf");
            let (_, warnings) = advanced_request(&runtime, op, &paths, &out, None,
                serde_json::json!({"pages":request.pages,"rotation":request.rotation.unwrap_or(90)}), &control).await?;
            return result(&out, warnings);
        }
        if matches!(op, "pdf-docx" | "pdf-xlsx" | "pdf-html" | "zip-images-pdf") {
            let target = if op == "zip-images-pdf" {
                "pdf"
            } else {
                op.trim_start_matches("pdf-")
            };
            let conversion = ConvertRequest {
                input_path: paths[0].to_string_lossy().into(),
                output_format: target.into(),
                options: Default::default(),
                job_id: None,
            };
            return convert(&runtime, &conversion, &dir, &control).await;
        }
        if matches!(
            op,
            "create-zip"
                | "create-7z"
                | "create-tar"
                | "create-tgz"
                | "create-tbz2"
                | "create-txz"
                | "extract-zip"
                | "decrypt-pdf"
        ) {
            let out = dir.join(match op {
                "extract-zip" => "unpacked",
                "create-zip" => "result.zip",
                "create-7z" => "result.7z",
                "create-tar" => "result.tar",
                "create-tgz" => "result.tar.gz",
                "create-tbz2" => "result.tar.bz2",
                "create-txz" => "result.tar.xz",
                _ => "result.pdf",
            });
            let (_, warnings) = advanced(
                &runtime,
                op,
                &paths,
                &out,
                request.password.as_deref(),
                &control,
            )
            .await?;
            return if op == "extract-zip" {
                directory_result(&out, warnings)
            } else {
                result(&out, warnings)
            };
        }
        let packed = matches!(op, "split-pdf" | "pdf-images" | "pdf-jpg");
        let out = dir.join(if packed {
            "pages"
        } else if matches!(op, "ocr" | "pdf-text") {
            "result.txt"
        } else {
            "result.pdf"
        });
        let warnings = if op == "pdf-jpg" {
            native_pages(
                &runtime,
                &paths[0],
                &out,
                "jpg",
                request.pages.as_deref(),
                &control,
            )
            .await?
        } else {
            native_tool(
                &runtime,
                op,
                &paths,
                &out,
                request.pages.as_deref(),
                request.group_size,
                &control,
            )
            .await?
        };
        if packed {
            control.stage("正在打包页面");
            let archive = dir.join("result.zip");
            pack(&out, &archive, &control).await?;
            result(&archive, warnings)
        } else {
            result(&out, warnings)
        }
    }
    .await;
    jobs.active.lock().unwrap().remove(&request.job_id);
    if output.is_err() {
        let _ = fs::remove_dir_all(&dir);
    }
    output
}

#[cfg(test)]
#[path = "convert_tests.rs"]
mod tests;

#[derive(serde::Deserialize)]
pub struct ZipResultFile {
    path: String,
    name: String,
}

#[tauri::command]
pub async fn zip_conversion_results(
    app: AppHandle,
    jobs: State<'_, Jobs>,
    files: Vec<ZipResultFile>,
    job_id: String,
) -> Result<ConvertResult> {
    let control = begin(&jobs, &app, &job_id)?;
    let dir = jobs.results.path().join(Uuid::new_v4().to_string());
    let output = match Runtime::from_app(&app) {
        Ok(runtime) => zip_result_files(&runtime, files, &dir, &control).await,
        Err(error) => Err(error),
    };
    jobs.active.lock().unwrap().remove(&job_id);
    if output.is_err() {
        let _ = fs::remove_dir_all(dir);
    }
    output
}

async fn zip_result_files(
    runtime: &Runtime,
    files: Vec<ZipResultFile>,
    dir: &Path,
    control: &Control,
) -> Result<ConvertResult> {
    if files.is_empty() || files.len() > 1000 {
        return Err(AppError::UnsupportedFormat(
            "请选择 1–1000 个结果文件。".into(),
        ));
    }
    let staging = dir.join("转换结果");
    fs::create_dir_all(&staging)?;
    let mut total = 0u64;
    for item in files {
        control.check()?;
        if item.name.is_empty()
            || item.name == "."
            || item.name == ".."
            || item.name.contains(['/', '\\', '\0'])
        {
            return Err(AppError::UnsupportedFormat("结果文件名无效。".into()));
        }
        let source = input(&item.path)?;
        total = total.saturating_add(fs::metadata(&source)?.len());
        if total > 2 * 1024 * 1024 * 1024 {
            return Err(AppError::UnsupportedFormat(
                "ZIP 结果总大小暂支持 2 GB 以内。".into(),
            ));
        }
        let name = Path::new(&item.name);
        let stem = name.file_stem().unwrap_or_default().to_string_lossy();
        let ext = name
            .extension()
            .map(|s| format!(".{}", s.to_string_lossy()))
            .unwrap_or_default();
        let mut target = staging.join(&item.name);
        let mut number = 1;
        while target.exists() {
            target = staging.join(format!("{stem} ({number}){ext}"));
            number += 1;
        }
        tokio::fs::copy(source, target).await?;
    }
    let zip = dir.join("转换结果.zip");
    let paths: Vec<PathBuf> = fs::read_dir(&staging)?
        .map(|entry| entry.map(|e| e.path()))
        .collect::<std::io::Result<_>>()?;
    advanced(runtime, "create-zip", &paths, &zip, None, control).await?;
    fs::remove_dir_all(staging)?;
    result(&zip, vec![])
}
