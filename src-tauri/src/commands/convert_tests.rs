use super::super::file_ops::{save_file, save_to_directory};
use super::*;
#[test]
fn rejects_cross_category_and_accepts_office_routes() {
    assert!(!output_formats("xlsx").contains(&"docx"));
    assert!(output_formats("xlsx").contains(&"pdf"));
    assert!(output_formats("pptx").contains(&"odp"));
    assert!(output_formats("csv").contains(&"xlsx"));
    assert!(output_formats("nothing").is_empty());
    assert_eq!(category("PDF"), "pdf");
}
#[tokio::test]
async fn batch_save_preserves_source_and_existing_files() {
    let dir = tempfile::tempdir().unwrap();
    let source = dir.path().join("source.txt");
    fs::write(&source, b"new").unwrap();
    let existing = dir.path().join("中文 测试.txt");
    fs::write(&existing, b"original").unwrap();
    let dest = save_to_directory(
        source.to_string_lossy().into(),
        dir.path().to_string_lossy().into(),
        "中文 测试.txt".into(),
    )
    .await
    .unwrap();
    assert!(dest.ends_with("中文 测试 (1).txt"));
    assert_eq!(fs::read(existing).unwrap(), b"original");
    assert_eq!(fs::read(dest).unwrap(), b"new");
    assert!(save_to_directory(
        source.to_string_lossy().into(),
        dir.path().to_string_lossy().into(),
        "../escape.txt".into()
    )
    .await
    .is_err());
    assert!(save_file(
        source.to_string_lossy().into(),
        source.to_string_lossy().into()
    )
    .await
    .is_err());
}
#[tokio::test]
async fn folder_save_reserves_names_and_rejects_self_descendants() {
    let dir = tempfile::tempdir().unwrap();
    let source = dir.path().join("source");
    fs::create_dir(&source).unwrap();
    fs::write(source.join("中文.txt"), b"kept").unwrap();
    let destination = dir.path().join("output");
    fs::create_dir(&destination).unwrap();
    fs::create_dir(destination.join("folder")).unwrap();
    let saved = save_to_directory(
        source.to_string_lossy().into(),
        destination.to_string_lossy().into(),
        "folder".into(),
    )
    .await
    .unwrap();
    assert!(saved.ends_with("folder (1)"));
    assert_eq!(
        fs::read(Path::new(&saved).join("中文.txt")).unwrap(),
        b"kept"
    );
    assert!(save_to_directory(
        source.to_string_lossy().into(),
        source.to_string_lossy().into(),
        "nested".into()
    )
    .await
    .is_err());
}
#[tokio::test]
#[ignore = "Runs real installed conversion engines and native test fixtures"]
async fn installed_engines_convert_real_fixtures() {
    let runtime = Runtime::resolve(Path::new(env!("CARGO_MANIFEST_DIR")));
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("work/fixtures");
    assert!(
        fixtures.join("digital.pdf").is_file(),
        "Run fixture generation first"
    );
    let (_tx, rx) = watch::channel(false);
    let control = Control {
        receiver: rx,
        app: None,
        id: "integration".into(),
    };
    let root = tempfile::tempdir().unwrap();
    for (name, format) in [
        ("中文 测试.png", "jpg"),
        ("中文 测试.png", "webp"),
        ("中文 测试.png", "avif"),
        ("中文 测试.png", "heic"),
        ("中文 测试.png", "jxl"),
        ("tone.wav", "mp3"),
        ("tone.wav", "flac"),
        ("video.mp4", "mkv"),
        ("video.mp4", "mp3"),
        ("中文 文档.md", "docx"),
        ("中文 文档.md", "epub"),
        ("中文 文档.md", "pdf"),
        ("中文 文档.docx", "pdf"),
        ("中文 文档.docx", "md"),
        ("中文 文档.docx", "odt"),
        ("中文 表格.csv", "xlsx"),
        ("中文 表格.csv", "pdf"),
        ("中文 演示.pptx", "pdf"),
        ("中文 演示.pptx", "odp"),
        ("digital.pdf", "txt"),
        ("structured.json", "yaml"),
        ("structured.json", "xml"),
        ("structured.json", "pdf"),
        ("structured.json", "docx"),
        ("plain.log", "txt"),
        ("plain.log", "csv"),
        ("中文 表格.csv", "xls"),
        ("中文 表格.csv", "html"),
        ("中文 表格.csv", "docx"),
        ("中文 表格.csv", "epub"),
        ("中文 演示.pptx", "png"),
        ("中文 演示.pptx", "jpg"),
        ("中文 演示.pptx", "html"),
        ("video.mp4", "flac"),
        ("video.mp4", "m4a"),
        ("video.mp4", "ogg"),
        ("video.mp4", "aac"),
        ("video.mp4", "opus"),
        ("video.mp4", "wma"),
        ("中文 测试.png", "pdf"),
        ("中文 测试.png", "txt"),
        ("中文 测试.png", "mp4"),
        ("中文 测试.png", "webm"),
        ("digital.pdf", "docx"),
        ("digital.pdf", "html"),
        ("table.pdf", "xlsx"),
        ("digital.pdf", "png"),
        ("digital.pdf", "jpg"),
    ] {
        let dir = root.path().join(Uuid::new_v4().to_string());
        let request = ConvertRequest {
            input_path: fixtures.join(name).to_string_lossy().into(),
            output_format: format.into(),
            options: Default::default(),
            job_id: None,
        };
        let result = convert(&runtime, &request, &dir, &control)
            .await
            .unwrap_or_else(|e| panic!("{name} -> {format}: {e}"));
        assert!(result.size_bytes > 0);
        let bytes = fs::read(&result.output_path).unwrap();
        if result.output_extension == "pdf" {
            assert!(bytes.starts_with(b"%PDF-"));
        }
        if name == "digital.pdf" && format == "txt" {
            assert!(String::from_utf8(bytes).unwrap().contains("VERT Enhanced"));
        }
        println!("PASS {name} -> {format}: {} bytes", result.size_bytes);
        if name == "中文 表格.csv" && format == "xlsx" {
            let second = ConvertRequest {
                input_path: result.output_path,
                output_format: "csv".into(),
                options: Default::default(),
                job_id: None,
            };
            let roundtrip = convert(
                &runtime,
                &second,
                &root.path().join("csv-roundtrip"),
                &control,
            )
            .await
            .unwrap();
            let text = fs::read_to_string(roundtrip.output_path).unwrap();
            assert!(text.contains("中文"));
            assert!(text.contains("a,b"));
            assert!(text.contains("Line\nbreak"));
            println!("PASS XLSX -> CSV Chinese/quotes/newlines roundtrip");
        }
    }
    let image_doc = fixtures.join("with-image.docx");
    if image_doc.is_file() {
        let request = ConvertRequest {
            input_path: image_doc.to_string_lossy().into(),
            output_format: "html".into(),
            options: Default::default(),
            job_id: None,
        };
        let exported = convert(
            &runtime,
            &request,
            &root.path().join("embedded-html"),
            &control,
        )
        .await
        .unwrap();
        let html = fs::read_to_string(exported.output_path).unwrap();
        assert!(
            html.contains("data:image/png;base64"),
            "HTML lost embedded image"
        );
        println!("PASS DOCX -> standalone HTML preserves embedded image");
    }
    for (operation, name, target) in [
        ("ocr", "中文 测试.png", "ocr.txt"),
        ("ocr", "scanned.pdf", "scan.txt"),
        ("pdf-text", "scanned.pdf", "scan-auto.txt"),
        ("merge-pdf", "digital.pdf", "merged.pdf"),
        ("images-pdf", "中文 测试.png", "images.pdf"),
        ("split-pdf", "digital.pdf", "split"),
        ("pdf-images", "digital.pdf", "render"),
    ] {
        let out = root.path().join(target);
        let inputs = if operation == "merge-pdf" {
            vec![fixtures.join(name), fixtures.join(name)]
        } else {
            vec![fixtures.join(name)]
        };
        native_tool(&runtime, operation, &inputs, &out, None, Some(2), &control)
            .await
            .unwrap_or_else(|e| panic!("{operation}: {e}"));
        if target.ends_with(".txt") {
            let text = fs::read_to_string(&out).unwrap();
            assert!(text.contains("VERT"), "{operation}: {text}");
            assert!(text.contains("中文"), "{operation}: {text}");
        }
        if operation == "split-pdf" {
            assert_eq!(fs::read_dir(&out).unwrap().count(), 2);
        }
        if operation == "pdf-images" {
            assert_eq!(fs::read_dir(&out).unwrap().count(), 3);
        }
        println!("PASS {operation}");
    }
    let archive = root.path().join("images.zip");
    advanced(
        &runtime,
        "create-zip",
        &[
            fixtures.join("中文 测试.png"),
            fixtures.join("中文 测试.png"),
        ],
        &archive,
        None,
        &control,
    )
    .await
    .unwrap();
    for target in ["unpack", "pdf"] {
        let request = ConvertRequest {
            input_path: archive.to_string_lossy().into(),
            output_format: target.into(),
            options: Default::default(),
            job_id: None,
        };
        let output = convert(
            &runtime,
            &request,
            &root.path().join(format!("archive-{target}")),
            &control,
        )
        .await
        .unwrap();
        if target == "unpack" {
            assert!(output.is_directory);
            assert_eq!(fs::read_dir(&output.output_path).unwrap().count(), 2);
        } else {
            assert!(fs::read(&output.output_path).unwrap().starts_with(b"%PDF-"));
        }
        println!("PASS ZIP -> {target}");
    }
    let decrypted = root.path().join("decrypted.pdf");
    advanced(
        &runtime,
        "decrypt-pdf",
        &[fixtures.join("encrypted.pdf")],
        &decrypted,
        Some("fixture-password"),
        &control,
    )
    .await
    .unwrap();
    println!("PASS encrypted PDF -> decrypted copy");
    assert!(native_tool(
        &runtime,
        "pdf-text",
        &[fixtures.join("broken.pdf")],
        &root.path().join("broken.txt"),
        None,
        None,
        &control
    )
    .await
    .is_err());
    assert!(native_tool(
        &runtime,
        "split-pdf",
        &[fixtures.join("digital.pdf")],
        &root.path().join("invalid"),
        Some("999"),
        Some(1),
        &control
    )
    .await
    .is_err());
    println!("PASS invalid PDF and out-of-range pages rejected");
}

#[tokio::test]
#[ignore = "Runs the full advertised output matrix using installed app resources; writes a review report"]
async fn installed_app_compatibility_matrix() {
    let resource = Path::new("/Applications/VERT Enhanced.app/Contents/Resources");
    assert!(resource.join("native-bin/vert-document-tools").is_file());
    let runtime = Runtime::resolve(resource);
    let project = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let fixtures = project.join("work/fixtures");
    let report_root = project.join("work/compatibility-20261024/matrix");
    fs::create_dir_all(&report_root).unwrap();
    let (_tx, rx) = watch::channel(false);
    let control = Control {
        receiver: rx,
        app: None,
        id: "compatibility".into(),
    };
    let mut rows = vec![];
    let mut failures = vec![];
    for name in [
        "中文 测试.png",
        "tone.wav",
        "video.mp4",
        "中文 文档.docx",
        "中文 表格.csv",
        "中文 演示.pptx",
        "structured.json",
        "digital.pdf",
    ] {
        let source = fixtures.join(name);
        let ext = extension(&source);
        for target in output_formats(&ext) {
            // PDF tables need a table fixture. Generic nested JSON cannot be flattened to CSV losslessly.
            let source = if ext == "pdf" && target == "xlsx" {
                fixtures.join("table.pdf")
            } else {
                source.clone()
            };
            let expected_rejection = ext == "json" && target == "csv";
            let outdir = report_root.join(format!("{ext}-to-{target}"));
            let request = ConvertRequest {
                input_path: source.to_string_lossy().into(),
                output_format: target.into(),
                options: Default::default(),
                job_id: None,
            };
            let started = std::time::Instant::now();
            let attempt = tokio::time::timeout(
                std::time::Duration::from_secs(90),
                convert(&runtime, &request, &outdir, &control),
            )
            .await;
            let (status, detail, output) = match attempt {
                Ok(Ok(result)) if !expected_rejection => {
                    // Decode media and images, rather than trusting a nonempty output file.
                    let validation = if result.output_extension == "zip" {
                        run(&runtime.python, &["-c".into(), "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.namelist(); assert z.testzip() is None".into(), result.output_path.clone()], &control).await
                    } else if matches!(category(target), "audio" | "video") {
                        run(
                            &runtime.ffmpeg,
                            &[
                                "-v".into(),
                                "error".into(),
                                "-nostdin".into(),
                                "-i".into(),
                                result.output_path.clone(),
                                "-f".into(),
                                "null".into(),
                                "-".into(),
                            ],
                            &control,
                        )
                        .await
                    } else if category(target) == "image" {
                        run(
                            &runtime.magick,
                            &[result.output_path.clone(), "null:".into()],
                            &control,
                        )
                        .await
                    } else if target == "pdf" {
                        run(&runtime.python, &["-c".into(), "import sys; from pypdf import PdfReader; assert len(PdfReader(sys.argv[1]).pages)>0".into(), result.output_path.clone()], &control).await
                    } else if matches!(
                        target,
                        "docx" | "xlsx" | "pptx" | "odt" | "ods" | "odp" | "epub"
                    ) {
                        run(&runtime.python, &["-c".into(), "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.namelist(); assert z.testzip() is None".into(), result.output_path.clone()], &control).await
                    } else {
                        Ok(String::new())
                    };
                    match validation {
                        Ok(_) => ("pass", result.warnings.join("; "), Some(result.output_path)),
                        Err(e) => (
                            "fail",
                            format!("Output cannot be decoded: {e}"),
                            Some(result.output_path),
                        ),
                    }
                }
                Ok(Err(e)) if expected_rejection && e.to_string().contains("表格结构") => {
                    ("expected_rejection", e.to_string(), None)
                }
                Ok(Ok(result)) => (
                    "fail",
                    "Nested JSON was silently flattened".into(),
                    Some(result.output_path),
                ),
                Ok(Err(e)) => ("fail", e.to_string(), None),
                Err(_) => ("fail", "Timed out after 90 seconds".into(), None),
            };
            let row = serde_json::json!({"source":source.file_name().unwrap().to_string_lossy(),"from":ext,"to":target,"status":status,"detail":detail,"output":output,"elapsed_ms":started.elapsed().as_millis()});
            println!("{status}: {ext} -> {target} {}", row["detail"]);
            if status == "fail" {
                failures.push(format!("{ext} -> {target}: {}", row["detail"]));
            }
            rows.push(row);
            fs::write(
                report_root.join("results.json"),
                serde_json::to_vec_pretty(&rows).unwrap(),
            )
            .unwrap();
        }
    }
    assert!(
        failures.is_empty(),
        "Compatibility failures:\n{}",
        failures.join("\n")
    );
}

#[tokio::test]
#[ignore = "Reads outputs of installed_app_compatibility_matrix and checks them as inputs"]
async fn generated_format_inputs_roundtrip() {
    let runtime = Runtime::resolve(Path::new(
        "/Applications/VERT Enhanced.app/Contents/Resources",
    ));
    let project = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let report_root = project.join("work/compatibility-20261024");
    let manifest: Vec<serde_json::Value> =
        serde_json::from_slice(&fs::read(report_root.join("matrix/results.json")).unwrap())
            .unwrap();
    let (_tx, rx) = watch::channel(false);
    let control = Control {
        receiver: rx,
        app: None,
        id: "compatibility-inputs".into(),
    };
    let mut rows = vec![];
    let mut failures = vec![];
    for case in manifest {
        if case["status"] != "pass" {
            continue;
        }
        let from = case["from"].as_str().unwrap();
        let generated = case["to"].as_str().unwrap();
        let target = match (from, generated) {
            ("png", value) if category(value) == "image" && value != "png" => "png",
            ("wav", value) if value != "wav" => "wav",
            ("mp4", value) if category(value) == "video" && value != "mp4" => "mp4",
            ("docx", "odt" | "rtf" | "epub" | "html") => "pdf",
            ("csv", "xlsx" | "xls" | "ods") => "csv",
            ("pptx", "odp") => "pdf",
            ("json", "yaml" | "xml") => "json",
            _ => continue,
        };
        let source = case["output"].as_str().unwrap();
        let outdir = report_root
            .join("inputs")
            .join(format!("{from}-via-{generated}-to-{target}"));
        let request = ConvertRequest {
            input_path: source.into(),
            output_format: target.into(),
            options: Default::default(),
            job_id: None,
        };
        let result = convert(&runtime, &request, &outdir, &control).await;
        let (status, detail, output) = match result {
            Ok(output) => ("pass", output.warnings.join("; "), Some(output.output_path)),
            Err(e) => ("fail", e.to_string(), None),
        };
        println!("{status}: {from} via {generated} -> {target}: {detail}");
        if status == "fail" {
            failures.push(format!("{generated} -> {target}: {detail}"));
        }
        rows.push(serde_json::json!({"original":from,"from":generated,"to":target,"status":status,"detail":detail,"output":output}));
        fs::write(
            report_root.join("input-results.json"),
            serde_json::to_vec_pretty(&rows).unwrap(),
        )
        .unwrap();
    }
    assert!(rows.len() > 30);
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

#[tokio::test]
#[ignore = "Runs real legacy Office, multiframe image, and Unicode path regression cases"]
async fn compatibility_edge_fixtures() {
    let runtime = Runtime::resolve(Path::new(
        "/Applications/VERT Enhanced.app/Contents/Resources",
    ));
    let project = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let root = project.join("work/compatibility-20261024/edges");
    fs::create_dir_all(&root).unwrap();
    let (_tx, rx) = watch::channel(false);
    let control = Control {
        receiver: rx,
        app: None,
        id: "compatibility-edges".into(),
    };
    let image = project.join("work/fixtures/中文 测试.png");
    let original = fs::read(&image).unwrap();
    let unicode = root.join("中文 空格 # [图] 🖼.PNG");
    fs::copy(&image, &unicode).unwrap();
    let gif = root.join("two-frames.gif");
    let tiff = root.join("two-pages.tiff");
    for output in [&gif, &tiff] {
        run(
            &runtime.magick,
            &[
                image.to_string_lossy().into(),
                image.to_string_lossy().into(),
                output.to_string_lossy().into(),
            ],
            &control,
        )
        .await
        .unwrap();
    }
    let mut rows = vec![];
    for (source, target, notice) in [
        (unicode, "webp", false),
        (gif, "png", true),
        (tiff, "jpg", true),
        (
            project.join("work/compatibility-20261024/legacy-fixtures/中文 文档.doc"),
            "pdf",
            false,
        ),
        (
            project.join("work/compatibility-20261024/legacy-fixtures/中文 演示.ppt"),
            "pdf",
            false,
        ),
    ] {
        let before = fs::read(&source).unwrap();
        let request = ConvertRequest {
            input_path: source.to_string_lossy().into(),
            output_format: target.into(),
            options: Default::default(),
            job_id: None,
        };
        let out = convert(
            &runtime,
            &request,
            &root.join(Uuid::new_v4().to_string()),
            &control,
        )
        .await
        .unwrap();
        assert_eq!(fs::read(&source).unwrap(), before, "Source was changed");
        if notice {
            assert!(
                out.warnings.iter().any(|w| w.contains("首帧")),
                "Missing first-frame warning"
            );
        }
        if target == "pdf" {
            let text = root.join(format!("{}.txt", Uuid::new_v4()));
            native_tool(
                &runtime,
                "pdf-text",
                &[PathBuf::from(&out.output_path)],
                &text,
                None,
                None,
                &control,
            )
            .await
            .unwrap();
            let contents = fs::read_to_string(text).unwrap();
            assert!(contents.contains("VERT Enhanced"), "Lost document text");
            assert!(contents.contains("中文"), "Lost Chinese text");
        } else {
            run(
                &runtime.magick,
                &[out.output_path.clone(), "null:".into()],
                &control,
            )
            .await
            .unwrap();
        }
        println!(
            "PASS {} -> {target}",
            source.file_name().unwrap().to_string_lossy()
        );
        rows.push(serde_json::json!({"source":source.file_name().unwrap().to_string_lossy(),"to":target,"status":"pass","output":out.output_path,"warnings":out.warnings}));
    }
    assert_eq!(fs::read(image).unwrap(), original);
    fs::write(
        root.join("results.json"),
        serde_json::to_vec_pretty(&rows).unwrap(),
    )
    .unwrap();
}

#[tokio::test]
#[ignore = "Uses generated complex Office, 1000-page PDF and two-minute video fixtures"]
async fn extended_complex_compatibility() {
    let runtime = Runtime::resolve(Path::new(
        "/Applications/VERT Enhanced.app/Contents/Resources",
    ));
    let project = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let root = project.join("work/compatibility-20261025");
    let (_tx, rx) = watch::channel(false);
    let control = Control {
        receiver: rx,
        app: None,
        id: "extended-compatibility".into(),
    };
    let mut rows = vec![];
    for (name, target) in [
        ("complex.docx", "pdf"),
        ("complex.docx", "odt"),
        ("complex.docx", "html"),
        ("complex.xlsx", "ods"),
        ("complex.xlsx", "pdf"),
        ("complex.xlsx", "csv"),
        ("complex.pptx", "pdf"),
        ("complex.pptx", "png"),
        ("thousand-pages.pdf", "txt"),
        ("two-minute.mp4", "mkv"),
        ("two-minute.mp4", "3gp"),
        ("two-minute.mp4", "mp3"),
    ] {
        let request = ConvertRequest {
            input_path: root.join("fixtures").join(name).to_string_lossy().into(),
            output_format: target.into(),
            options: Default::default(),
            job_id: None,
        };
        let outdir = root.join("outputs").join(format!("{name}-to-{target}"));
        let start = std::time::Instant::now();
        let attempt = tokio::time::timeout(
            std::time::Duration::from_secs(180),
            convert(&runtime, &request, &outdir, &control),
        )
        .await;
        let row = match attempt {
            Ok(Ok(out)) => {
                serde_json::json!({"source":name,"to":target,"status":"pass","output":out.output_path,"warnings":out.warnings,"elapsed_ms":start.elapsed().as_millis()})
            }
            Ok(Err(e)) => {
                serde_json::json!({"source":name,"to":target,"status":"fail","detail":e.to_string()})
            }
            Err(_) => {
                serde_json::json!({"source":name,"to":target,"status":"fail","detail":"180 second timeout"})
            }
        };
        println!("{row}");
        rows.push(row);
        fs::write(
            root.join("complex-results.json"),
            serde_json::to_vec_pretty(&rows).unwrap(),
        )
        .unwrap();
    }
    assert!(
        rows.iter().all(|r| r["status"] == "pass"),
        "See complex-results.json"
    );
}

#[tokio::test]
#[ignore = "Uses checksum-verified public real camera RAW files"]
async fn real_camera_raw_compatibility() {
    let runtime = Runtime::resolve(Path::new(
        "/Applications/VERT Enhanced.app/Contents/Resources",
    ));
    let project = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let root = project.join("work/compatibility-20261025");
    assert!(
        root.join("fixtures/raw-sources.json").is_file(),
        "Download and verify public samples first"
    );
    let (_tx, rx) = watch::channel(false);
    let control = Control {
        receiver: rx,
        app: None,
        id: "raw-compatibility".into(),
    };
    let samples: Vec<serde_json::Value> =
        serde_json::from_slice(&fs::read(root.join("fixtures/raw-sources.json")).unwrap()).unwrap();
    let mut rows = vec![];
    for sample in samples {
        let name = sample["name"].as_str().unwrap();
        for target in ["jpg", "png"] {
            let request = ConvertRequest {
                input_path: root.join("fixtures").join(name).to_string_lossy().into(),
                output_format: target.into(),
                options: Default::default(),
                job_id: None,
            };
            let started = std::time::Instant::now();
            let result = convert(
                &runtime,
                &request,
                &root.join("raw-outputs").join(format!("{name}-to-{target}")),
                &control,
            )
            .await;
            let row = match result {
                Ok(out) => {
                    serde_json::json!({"source":name,"to":target,"status":"pass","output":out.output_path,"warnings":out.warnings,"elapsed_ms":started.elapsed().as_millis()})
                }
                Err(e) => {
                    serde_json::json!({"source":name,"to":target,"status":"fail","detail":e.to_string()})
                }
            };
            println!("{row}");
            rows.push(row);
            fs::write(
                root.join("raw-results.json"),
                serde_json::to_vec_pretty(&rows).unwrap(),
            )
            .unwrap();
        }
    }
    assert!(
        rows.iter().all(|r| r["status"] == "pass"),
        "See raw-results.json"
    );
}

#[tokio::test]
#[ignore = "Starts and cancels a real FFmpeg process using production cancellation control"]
async fn installed_ffmpeg_cancellation() {
    let runtime = Runtime::resolve(Path::new(
        "/Applications/VERT Enhanced.app/Contents/Resources",
    ));
    let (tx, rx) = watch::channel(false);
    let control = Control {
        receiver: rx,
        app: None,
        id: "cancel-compatibility".into(),
    };
    let started = std::time::Instant::now();
    let args = strings(&[
        "-v",
        "error",
        "-nostdin",
        "-re",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=320x240:rate=24",
        "-f",
        "null",
        "-",
    ]);
    let cancel = async {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        tx.send(true).unwrap();
    };
    let (result, _) = tokio::join!(run(&runtime.ffmpeg, &args, &control), cancel);
    assert!(result.unwrap_err().to_string().contains("取消"));
    assert!(started.elapsed() < std::time::Duration::from_secs(5));
}

#[tokio::test]
#[ignore = "Checks visible CJK glyphs by raster OCR, not only PDF text extraction"]
async fn office_pdf_visible_chinese_regression() {
    let runtime = Runtime::resolve(Path::new(
        "/Applications/VERT Enhanced.app/Contents/Resources",
    ));
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("work/compatibility-20261025");
    let (_tx, rx) = watch::channel(false);
    let control = Control {
        receiver: rx,
        app: None,
        id: "font-regression".into(),
    };
    for (name, expected) in [("complex.docx", "兼容"), ("complex.pptx", "演示")] {
        let outdir = root.join("font-regression").join(name);
        let request = ConvertRequest {
            input_path: root.join("fixtures").join(name).to_string_lossy().into(),
            output_format: "pdf".into(),
            options: Default::default(),
            job_id: None,
        };
        let pdf = convert(&runtime, &request, &outdir, &control)
            .await
            .unwrap();
        let text = outdir.join("visible-ocr.txt");
        native_tool(
            &runtime,
            "ocr",
            &[PathBuf::from(pdf.output_path)],
            &text,
            Some("1"),
            None,
            &control,
        )
        .await
        .unwrap();
        assert!(
            fs::read_to_string(text).unwrap().contains(expected),
            "PDF has invisible Chinese glyphs: {name}"
        );
    }
}

#[test]
fn remux_policy_respects_container_codec_support() {
    assert!(remux_codecs_fit("mkv", Some("vp9"), Some("opus")));
    assert!(remux_codecs_fit("ts", Some("h264"), Some("aac")));
    assert!(remux_codecs_fit("mp4", Some("hevc"), Some("aac")));
    assert!(!remux_codecs_fit("ts", Some("vp9"), Some("opus")));
    assert!(!remux_codecs_fit("mp4", Some("h264"), Some("vorbis")));
}

#[tokio::test]
#[ignore = "Generates real media and verifies sample rates and container fallback using installed engines"]
async fn audio_defaults_and_video_remux_regression() {
    let runtime = Runtime::resolve(Path::new(env!("CARGO_MANIFEST_DIR")));
    let (_tx, receiver) = watch::channel(false);
    let control = Control {
        receiver,
        app: None,
        id: "media-policy".into(),
    };
    let root = tempfile::tempdir().unwrap();
    let wav = root.path().join("48khz.wav");
    let video = root.path().join("vp9.webm");
    for args in [
        vec![
            "-y",
            "-f",
            "lavfi",
            "-i",
            "sine=sample_rate=48000:duration=0.3",
            wav.to_str().unwrap(),
        ],
        vec![
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=s=64x64:d=0.3",
            "-f",
            "lavfi",
            "-i",
            "sine=sample_rate=48000:duration=0.3",
            "-c:v",
            "libvpx-vp9",
            "-c:a",
            "libopus",
            video.to_str().unwrap(),
        ],
    ] {
        run(&runtime.ffmpeg, &strings(&args), &control)
            .await
            .unwrap();
    }
    let probe = runtime.ffmpeg.parent().unwrap().join("ffprobe");
    for (source, target, rate, codec, expected_rate) in [
        (&wav, "flac", Some(0), "flac", Some("48000")),
        (&wav, "flac", Some(44100), "flac", Some("44100")),
        (&wav, "opus", Some(44100), "opus", Some("48000")),
        (&video, "mkv", None, "vp9", None),
        (&video, "ts", None, "h264", None),
        (&video, "ogv", None, "vp8", None),
    ] {
        let output = convert(
            &runtime,
            &ConvertRequest {
                input_path: source.to_string_lossy().into(),
                output_format: target.into(),
                options: ConvertOptions {
                    sample_rate: rate,
                    ..Default::default()
                },
                job_id: None,
            },
            &root.path().join(Uuid::new_v4().to_string()),
            &control,
        )
        .await
        .unwrap();
        let raw = run(
            &probe,
            &strings(&[
                "-v",
                "error",
                "-show_streams",
                "-of",
                "json",
                &output.output_path,
            ]),
            &control,
        )
        .await
        .unwrap();
        let metadata: serde_json::Value = serde_json::from_str(&raw).unwrap();
        let stream = &metadata["streams"][0];
        assert_eq!(stream["codec_name"].as_str(), Some(codec), "{target}");
        if let Some(expected) = expected_rate {
            assert_eq!(stream["sample_rate"].as_str(), Some(expected));
        }
        if target == "opus" || target == "mkv" || target == "ts" {
            assert!(!output.warnings.is_empty());
        }
    }
}

#[test]
fn ncm_is_input_only_with_original_audio_restore() {
    assert_eq!(category("NCM"), "audio");
    assert!(output_formats("ncm").contains(&"restore-audio"));
    assert!(output_formats("ncm").contains(&"flac"));
    assert!(!output_formats("ncm").contains(&"ncm"));
    assert!(!output_formats("wav").contains(&"restore-audio"));
}

#[tokio::test]
#[ignore = "Generates original MP3/FLAC and NCM containers, checks restored PCM and metadata with real engines"]
async fn ncm_restoration_preserves_audio_and_metadata() {
    let runtime = Runtime::resolve(Path::new(env!("CARGO_MANIFEST_DIR")));
    let (_tx, receiver) = watch::channel(false);
    let control = Control {
        receiver,
        app: None,
        id: "ncm-regression".into(),
    };
    let root = tempfile::tempdir().unwrap();
    let tests = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("tests");
    for format in ["mp3", "flac"] {
        let audio = root.path().join(format!("original.{format}"));
        let ncm = root.path().join(format!("source-{format}.ncm"));
        run(
            &runtime.ffmpeg,
            &strings(&[
                "-v",
                "error",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "sine=sample_rate=48000:duration=0.3",
                audio.to_str().unwrap(),
            ]),
            &control,
        )
        .await
        .unwrap();
        run(&runtime.python, &vec!["-c".into(), "import sys;from pathlib import Path;sys.dont_write_bytecode=True;sys.path.insert(0,sys.argv[1]);from test_ncm import make_ncm;Path(sys.argv[3]).write_bytes(make_ncm(Path(sys.argv[2]).read_bytes(),{'musicName':'中文测试'},padding=1024))".into(),tests.to_string_lossy().into(),audio.to_string_lossy().into(),ncm.to_string_lossy().into()], &control).await.unwrap();
        let before = fs::read(&ncm).unwrap();
        let restored = convert(
            &runtime,
            &ConvertRequest {
                input_path: ncm.to_string_lossy().into(),
                output_format: "restore-audio".into(),
                options: Default::default(),
                job_id: None,
            },
            &root.path().join(format!("out-{format}")),
            &control,
        )
        .await
        .unwrap();
        assert_eq!(restored.output_extension, format);
        assert_eq!(fs::read(&ncm).unwrap(), before);
        let original_pcm = run(
            &runtime.ffmpeg,
            &strings(&[
                "-v",
                "error",
                "-i",
                audio.to_str().unwrap(),
                "-map",
                "0:a:0",
                "-f",
                "hash",
                "-hash",
                "sha256",
                "-",
            ]),
            &control,
        )
        .await
        .unwrap();
        let restored_pcm = run(
            &runtime.ffmpeg,
            &strings(&[
                "-v",
                "error",
                "-i",
                &restored.output_path,
                "-map",
                "0:a:0",
                "-f",
                "hash",
                "-hash",
                "sha256",
                "-",
            ]),
            &control,
        )
        .await
        .unwrap();
        assert_eq!(original_pcm, restored_pcm);
        let probe = runtime.ffmpeg.parent().unwrap().join("ffprobe");
        let meta = run(
            &probe,
            &strings(&[
                "-v",
                "error",
                "-show_entries",
                "format_tags=title",
                "-of",
                "json",
                &restored.output_path,
            ]),
            &control,
        )
        .await
        .unwrap();
        assert!(meta.contains("中文测试"));
    }
}

#[tokio::test]
#[ignore = "Uses real macOS ZIP writer and installed Python to inspect Unicode names and duplicate contents"]
async fn zipped_results_preserve_collisions_and_reject_path_names() {
    let root = tempfile::tempdir().unwrap();
    let (_tx, receiver) = watch::channel(false);
    let control = Control {
        receiver,
        app: None,
        id: "zip-regression".into(),
    };
    let first = root.path().join("first.mp3");
    let second = root.path().join("second.mp3");
    fs::write(&first, b"first").unwrap();
    fs::write(&second, b"second").unwrap();
    let files = vec![
        ZipResultFile {
            path: first.to_string_lossy().into(),
            name: "相思.mp3".into(),
        },
        ZipResultFile {
            path: second.to_string_lossy().into(),
            name: "相思.mp3".into(),
        },
    ];
    let runtime = Runtime::resolve(Path::new(env!("CARGO_MANIFEST_DIR")));
    let result = zip_result_files(&runtime, files, &root.path().join("zip"), &control)
        .await
        .unwrap();
    let runtime = Runtime::resolve(Path::new(env!("CARGO_MANIFEST_DIR")));
    let script="import sys,json,zipfile; z=zipfile.ZipFile(sys.argv[1]); names=z.namelist(); assert z.testzip() is None; assert not any('/._' in n for n in names); print(json.dumps({n:z.read(n).decode() for n in names if not n.endswith('/')},ensure_ascii=True))";
    let raw = run(
        &runtime.python,
        &vec!["-c".into(), script.into(), result.output_path.clone()],
        &control,
    )
    .await
    .unwrap();
    let entries: serde_json::Value = serde_json::from_str(&raw).unwrap();
    assert_eq!(entries["相思.mp3"], "first");
    assert_eq!(entries["相思 (1).mp3"], "second");
    let invalid = vec![ZipResultFile {
        path: first.to_string_lossy().into(),
        name: "../escape.mp3".into(),
    }];
    assert!(
        zip_result_files(&runtime, invalid, &root.path().join("invalid"), &control)
            .await
            .is_err()
    );
    assert_eq!(fs::read(first).unwrap(), b"first");
}
