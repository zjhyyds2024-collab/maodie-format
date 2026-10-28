import AppKit
import PDFKit
import Foundation
let dir=URL(fileURLWithPath:CommandLine.arguments[1]);try FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true)
let text="VERT Enhanced Test 2026\n中文格式转换测试\nInvoice Total 123.45"
let attrs:[NSAttributedString.Key:Any]=[.font:NSFont.systemFont(ofSize:36),.foregroundColor:NSColor.black]
let image=NSImage(size:NSSize(width:1200,height:500));image.lockFocus();NSColor.white.setFill();NSBezierPath(rect:NSRect(x:0,y:0,width:1200,height:500)).fill();(text as NSString).draw(in:NSRect(x:70,y:90,width:1060,height:330),withAttributes:attrs);image.unlockFocus()
let rep=NSBitmapImageRep(data:image.tiffRepresentation!)!;try rep.representation(using:.png,properties:[:])!.write(to:dir.appendingPathComponent("中文 测试.png"))
let scan=PDFDocument();scan.insert(PDFPage(image:image)!,at:0);scan.write(to:dir.appendingPathComponent("scanned.pdf"))
var media=CGRect(x:0,y:0,width:612,height:792)
let ctx=CGContext(dir.appendingPathComponent("digital.pdf") as CFURL,mediaBox:&media,nil)!
for index in 1...3 { ctx.beginPDFPage(nil);NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(cgContext:ctx,flipped:false);NSColor.white.setFill();NSBezierPath(rect:media).fill();("Page \(index)\n"+text as NSString).draw(in:NSRect(x:40,y:200,width:530,height:540),withAttributes:attrs);NSGraphicsContext.restoreGraphicsState();ctx.endPDFPage() };ctx.closePDF()
try "# 格式转换测试\n\nHello VERT Enhanced 2026.\n\n| Name | Value |\n|---|---|\n| 中文 | 123 |\n".write(to:dir.appendingPathComponent("中文 文档.md"),atomically:true,encoding:.utf8)
try "Name,Value,Notes\n中文,123,\"a,b\"\n\"Line\nbreak\",42,\"He said \"\"Hi\"\"\"\n".write(to:dir.appendingPathComponent("中文 表格.csv"),atomically:true,encoding:.utf8)
try "not a real PDF".write(to:dir.appendingPathComponent("broken.pdf"),atomically:true,encoding:.utf8)
print("Created native fixtures")

try "# Image document\n\n![Sample](中文 测试.png)\n".write(to:dir.appendingPathComponent("with-image.md"),atomically:true,encoding:.utf8)
