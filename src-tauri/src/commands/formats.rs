use std::path::Path;
pub fn category(ext: &str) -> &'static str {
    if encrypted_music(&ext.to_lowercase()) {
        return "audio";
    }
    match ext.to_lowercase().as_str() {
        "mp3" | "wav" | "flac" | "ogg" | "opus" | "aac" | "alac" | "m4a" | "wma" | "aiff"
        | "mp2" | "au" | "m4b" | "voc" | "ncm" => "audio",
        "mp4" | "mkv" | "webm" | "avi" | "mov" | "wmv" | "mts" | "ts" | "m2ts" | "mpg" | "mpeg"
        | "flv" | "vob" | "m4v" | "3gp" | "ogv" => "video",
        "docx" | "doc" | "md" | "txt" | "html" | "htm" | "rtf" | "csv" | "tsv" | "rst" | "epub"
        | "odt" | "xls" | "xlsx" | "xlsm" | "ods" | "ppt" | "pptx" | "odp" | "wps" | "wpt"
        | "wpd" | "et" | "ett" | "dps" | "dpt" | "json" | "xml" | "yaml" | "yml" | "log" => {
            "document"
        }
        "pdf" => "pdf",
        "zip" | "7z" | "rar" | "tar" | "gz" | "tgz" | "bz2" | "tbz2" | "xz" | "txz" => "archive",
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "tif" | "tiff" | "avif" | "heic"
        | "heif" | "jxl" | "ico" | "svg" | "psd" | "exr" | "hdr" | "dng" | "nef" | "cr2"
        | "cr3" | "crw" | "arw" | "tga" | "raf" | "rw2" | "orf" | "pef" | "srw" | "3fr" | "erf"
        | "fff" | "iiq" | "kdc" | "mef" | "mrw" | "x3f" => "image",
        _ => "unknown",
    }
}
pub(super) fn structured_source(ext: &str) -> bool {
    matches!(ext, "json" | "xml" | "yaml" | "yml" | "log")
}
pub(super) fn spreadsheet(ext: &str) -> bool {
    matches!(
        ext,
        "xls" | "xlsx" | "xlsm" | "ods" | "csv" | "tsv" | "et" | "ett"
    )
}
pub(super) fn presentation(ext: &str) -> bool {
    matches!(ext, "ppt" | "pptx" | "odp" | "dps" | "dpt")
}
pub(super) fn office_input(ext: &str) -> bool {
    spreadsheet(ext)
        || presentation(ext)
        || matches!(ext, "doc" | "docx" | "odt" | "rtf" | "wps" | "wpt" | "wpd")
}
pub fn output_formats(ext: &str) -> Vec<&'static str> {
    match ext {
        _ if encrypted_music(ext) => vec![
            "restore-audio",
            "mp3",
            "wav",
            "flac",
            "ogg",
            "opus",
            "aac",
            "m4a",
            "wma",
            "aiff",
            "mp2",
            "au",
        ],
        "csv" => vec![
            "xlsx", "xls", "ods", "csv", "pdf", "html", "txt", "md", "json", "xml", "yaml", "docx",
            "epub",
        ],
        _ if spreadsheet(ext) => vec!["xlsx", "xls", "ods", "csv", "pdf", "html"],
        _ if presentation(ext) => vec!["pptx", "odp", "pdf", "html", "png", "jpg"],
        "doc" | "docx" | "odt" | "rtf" | "wps" | "wpt" | "wpd" => {
            vec!["docx", "odt", "rtf", "html", "md", "txt", "epub", "pdf"]
        }
        "pdf" => vec!["txt", "docx", "xlsx", "html", "png", "jpg"],
        "zip" => vec!["unpack", "pdf"],
        "7z" | "rar" | "tar" | "gz" | "tgz" | "bz2" | "tbz2" | "xz" | "txz" => vec!["unpack"],
        "txt" | "md" | "html" | "htm" | "json" | "xml" | "yaml" | "yml" | "log" => vec![
            "docx", "odt", "rtf", "md", "txt", "html", "rst", "epub", "pdf", "json", "xml", "yaml",
            "csv",
        ],
        _ => match category(ext) {
            "document" => vec![
                "docx", "odt", "rtf", "md", "txt", "html", "rst", "epub", "pdf",
            ],
            "image" => vec![
                "png", "jpg", "webp", "gif", "bmp", "tiff", "avif", "heic", "jxl", "ico", "psd",
                "exr", "hdr", "pdf", "txt", "mp4", "webm",
            ],
            "audio" => vec![
                "mp3", "wav", "flac", "ogg", "opus", "aac", "m4a", "wma", "aiff", "mp2", "au",
            ],
            "video" => vec![
                "mp4", "mkv", "webm", "avi", "mov", "wmv", "ts", "m4v", "3gp", "ogv", "flv", "mp3",
                "wav", "flac", "m4a", "ogg", "aac", "opus", "wma", "gif",
            ],
            _ => vec![],
        },
    }
}

pub(super) fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_lowercase()
}

pub fn encrypted_music(ext: &str) -> bool {
    matches!(
        ext,
        "ncm"
            | "mflac"
            | "mgg"
            | "mflac0"
            | "mgg0"
            | "mgg1"
            | "mggl"
            | "mmp4"
            | "qmcflac"
            | "qmcogg"
            | "qmc0"
            | "qmc1"
            | "qmc2"
            | "qmc3"
            | "qmc4"
            | "qmc5"
            | "qmc6"
            | "qmc7"
            | "qmc8"
            | "tkm"
            | "bkcmp3"
            | "bkcm4a"
            | "bkcflac"
            | "bkcwav"
            | "bkcape"
            | "bkcogg"
            | "bkcwma"
            | "666c6163"
            | "6d7033"
            | "6f6767"
            | "6d3461"
            | "776176"
            | "kgm"
            | "kgma"
            | "vpr"
            | "kwm"
    )
}

pub fn source_extension(path: &Path) -> String {
    use std::io::{Read, Seek, SeekFrom};
    let ext = extension(path);
    let name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    if name.ends_with(".kgm.flac") {
        return "kgm".into();
    }
    if name.ends_with(".vpr.flac") {
        return "vpr".into();
    }
    if let Ok(mut file) = std::fs::File::open(path) {
        let mut head = [0u8; 16];
        if let Ok(n) = file.read(&mut head) {
            if n >= 8 && &head[..8] == b"CTENFDAM" {
                return "ncm".into();
            }
            if n == 16
                && head
                    == [
                        0x7c, 0xd5, 0x32, 0xeb, 0x86, 0x02, 0x7f, 0x4b, 0xa8, 0xaf, 0xa6, 0x8e,
                        0x0f, 0xff, 0x99, 0x14,
                    ]
            {
                return "kgm".into();
            }
            if n == 16
                && head
                    == [
                        0x05, 0x28, 0xbc, 0x96, 0xe9, 0xe4, 0x5a, 0x43, 0x91, 0xaa, 0xbd, 0xd0,
                        0x7a, 0xf5, 0x36, 0x31,
                    ]
            {
                return "vpr".into();
            }
            if n >= 12 && head.starts_with(b"yeelion-kuwo") {
                return "kwm".into();
            }
        }
        if category(&ext) == "unknown" && file.seek(SeekFrom::End(-4)).is_ok() {
            let mut tail = [0u8; 4];
            if file.read_exact(&mut tail).is_ok() && (&tail == b"QTag" || &tail == b"STag") {
                return "mflac".into();
            }
        }
    }
    ext
}
