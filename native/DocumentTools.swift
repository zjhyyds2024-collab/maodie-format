import Foundation
import AppKit
import PDFKit
import Vision
import ImageIO

struct Request: Decodable {
    let operation: String
    let input_paths: [String]
    let output_path: String
    let pages: String?
    let group_size: Int?
    let image_format: String?
}
struct Failure: Error, CustomStringConvertible {
    let description: String
    init(_ message: String) { description = message }
}
func emit(_ value: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]), let line = String(data: data, encoding: .utf8) {
        print(line); fflush(stdout)
    }
}
func progress(_ current: Int, _ total: Int, _ stage: String) { emit(["current": current, "total": total, "stage": stage]) }
func loadPDF(_ path: String) throws -> PDFDocument {
    guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else { throw Failure("无法读取 PDF：\(URL(fileURLWithPath: path).lastPathComponent)") }
    guard !doc.isLocked else { throw Failure("PDF 已加密，请先用原密码解锁后重试。") }
    guard doc.pageCount > 0 else { throw Failure("PDF 不包含可处理的页面。") }
    return doc
}
func selectedPages(_ text: String?, count: Int) throws -> [Int] {
    guard let text = text, !text.trimmingCharacters(in: .whitespaces).isEmpty else { return Array(0..<count) }
    var result: [Int] = []
    for component in text.split(separator: ",", omittingEmptySubsequences: false) {
        let range = component.trimmingCharacters(in: .whitespaces).split(separator: "-", omittingEmptySubsequences: false)
        guard range.count == 1 || range.count == 2, let start = Int(range[0]), start >= 1 else { throw Failure("页码格式应为 1-3,5；页码从 1 开始。") }
        let end = range.count == 2 ? Int(range[1]) : start
        guard let end = end, end >= start, end <= count else { throw Failure("页码超出文档范围（共 \(count) 页）。") }
        result.append(contentsOf: (start...end).map { $0 - 1 })
    }
    guard !result.isEmpty else { throw Failure("请选择至少一页。") }
    return result
}
func bitmap(_ image: NSImage) throws -> CGImage {
    var rect = CGRect(origin: .zero, size: image.size)
    guard let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else { throw Failure("无法解码图片。") }
    guard cg.width <= 20000, cg.height <= 20000, Int64(cg.width) * Int64(cg.height) <= 50_000_000 else { throw Failure("图片超过安全处理上限（最长边 20000 像素、总计 5000 万像素）。请先按比例缩小后重试，原文件不会修改。") }
    return cg
}
func render(_ page: PDFPage) throws -> CGImage {
    let bounds = page.bounds(for: .mediaBox)
    guard bounds.width > 0, bounds.height > 0 else { throw Failure("PDF 页面尺寸无效。") }
    let size = CGSize(width: bounds.width * 2, height: bounds.height * 2)
    guard size.width * size.height <= 50_000_000 else { throw Failure("PDF 页面超过 5000 万像素处理上限。") }
    return try bitmap(page.thumbnail(of: size, for: .mediaBox))
}
func recognize(_ cg: CGImage) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    request.usesLanguageCorrection = true
    try VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}
func savePDF(_ doc: PDFDocument, _ path: String) throws {
    guard doc.write(to: URL(fileURLWithPath: path)) else { throw Failure("PDF 写入失败。") }
}
func execute(_ req: Request) throws {
    let out = URL(fileURLWithPath: req.output_path)
    let fm = FileManager.default
    try fm.createDirectory(at: out.deletingLastPathComponent(), withIntermediateDirectories: true)
    guard !req.input_paths.isEmpty else { throw Failure("请添加文件。") }
    var outputs: [String] = []
    var warnings: [String] = []
    switch req.operation {
    case "preview":
        let source = req.input_paths[0]
        let cg: CGImage
        var pageCount = 0
        if URL(fileURLWithPath: source).pathExtension.lowercased() == "pdf" {
            let doc = try loadPDF(source)
            pageCount = doc.pageCount
            guard let page = doc.page(at: 0) else { throw Failure("无法读取 PDF 首页。") }
            let bounds = page.bounds(for: .mediaBox)
            guard bounds.width.isFinite, bounds.height.isFinite, bounds.width > 0, bounds.height > 0 else { throw Failure("页面尺寸无效。") }
            let scale = min(1400 / bounds.width, 1400 / bounds.height)
            cg = try bitmap(page.thumbnail(of: CGSize(width: bounds.width * scale, height: bounds.height * scale), for: .mediaBox))
        } else {
            guard let imageSource = CGImageSourceCreateWithURL(URL(fileURLWithPath: source) as CFURL, nil),
                  let image = CGImageSourceCreateThumbnailAtIndex(imageSource, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 1400, kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary) else { throw Failure("此图片无法预览，请使用系统应用打开。") }
            cg = image
        }
        guard let data = NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:]) else { throw Failure("预览编码失败。") }
        try data.write(to: out)
        emit(["pages": pageCount, "outputs": [out.path]])
        return
    case "merge-pdf", "images-pdf":
        let doc = PDFDocument()
        for (i, path) in req.input_paths.enumerated() {
            if req.operation == "merge-pdf" {
                let source = try loadPDF(path)
                for j in 0..<source.pageCount { guard let page = source.page(at: j)?.copy() as? PDFPage else { throw Failure("无法读取页面。") }; doc.insert(page, at: doc.pageCount) }
            } else {
                guard let image = NSImage(contentsOfFile: path) else { throw Failure("无法读取图片：\(path)") }
                _ = try bitmap(image)
                guard let page = PDFPage(image: image) else { throw Failure("无法将图片加入 PDF。") }
                doc.insert(page, at: doc.pageCount)
            }
            progress(i+1, req.input_paths.count, "正在合并")
        }
        try savePDF(doc, out.path); outputs = [out.path]
    case "split-pdf", "pdf-images", "pdf-text", "ocr":
        let input = req.input_paths[0]
        if req.operation == "ocr" && URL(fileURLWithPath: input).pathExtension.lowercased() != "pdf" {
            guard let image = NSImage(contentsOfFile: input) else { throw Failure("无法读取 OCR 图片。") }
            let text = try recognize(bitmap(image))
            guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw Failure("未识别到文字，请使用更清晰的图片。") }
            try text.write(to: out, atomically: true, encoding: .utf8)
            progress(1, 1, "文字识别完成"); outputs = [out.path]
            break
        }
        let doc = try loadPDF(input)
        let pages = try selectedPages(req.pages, count: doc.pageCount)
        let group = req.group_size ?? 1
        guard group >= 1 else { throw Failure("每组页数必须大于零。") }
        if req.operation == "split-pdf" || req.operation == "pdf-images" { try fm.createDirectory(at: out, withIntermediateDirectories: true) }
        var textParts: [String] = []
        var splitDoc = PDFDocument()
        for (index, pageIndex) in pages.enumerated() {
            try autoreleasepool {
                guard let page = doc.page(at: pageIndex) else { throw Failure("第 \(pageIndex+1) 页读取失败。") }
                switch req.operation {
                case "split-pdf":
                    guard let copied = page.copy() as? PDFPage else { throw Failure("页面复制失败。") }
                    splitDoc.insert(copied, at: splitDoc.pageCount)
                    if splitDoc.pageCount == group || index == pages.count-1 {
                        let path = out.appendingPathComponent(String(format: "part-%04d.pdf", outputs.count+1)).path
                        try savePDF(splitDoc, path); outputs.append(path); splitDoc = PDFDocument()
                    }
                case "pdf-images":
                    let image = try render(page)
                    let rep = NSBitmapImageRep(cgImage: image)
                    let jpeg = req.image_format == "jpg"
                    guard let data = rep.representation(using: jpeg ? .jpeg : .png, properties: [.compressionFactor: 0.92]) else { throw Failure("图片编码失败。") }
                    let path = out.appendingPathComponent(String(format: "page-%04d", pageIndex+1) + (jpeg ? ".jpg" : ".png")).path
                    try data.write(to: URL(fileURLWithPath: path)); outputs.append(path)
                default:
                    var text = req.operation == "ocr" ? "" : (page.string ?? "")
                    if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        text = try recognize(render(page))
                        if req.operation == "pdf-text" { warnings.append("第 \(pageIndex+1) 页无文字层，已使用 OCR。") }
                    }
                    if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { warnings.append("第 \(pageIndex+1) 页未识别到文字。") }
                    textParts.append("—— 第 \(pageIndex+1) 页 ——\n\(text)")
                }
            }
            progress(index+1, pages.count, req.operation == "ocr" ? "正在识别文字" : "正在处理页面")
        }
        if req.operation == "pdf-text" || req.operation == "ocr" {
            guard warnings.filter({ $0.contains("未识别到文字") }).count < pages.count else { throw Failure("所选页面均未识别到文字。") }
            try textParts.joined(separator: "\n\n").write(to: out, atomically: true, encoding: .utf8); outputs = [out.path]
        }
    default: throw Failure("不支持的文档操作：\(req.operation)")
    }
    emit(["outputs": outputs, "warnings": warnings])
}
do {
    guard CommandLine.arguments.count == 2, let data = CommandLine.arguments[1].data(using: .utf8) else { throw Failure("Expected one JSON request.") }
    try execute(JSONDecoder().decode(Request.self, from: data))
} catch {
    fputs("\(error)\n", stderr)
    exit(1)
}
