import { ScanText, Files, Scissors, Image, FileText, FileImage, FileSpreadsheet, FileType2, LockKeyhole, Archive, FolderOpen, RotateCw, ListOrdered, Trash2, Copy } from "lucide-react";
export const operations = [
  {id:"merge-pdf",zh:"合并 PDF",en:"Merge PDFs",detail:"按队列顺序合并多个 PDF",english:"Combine PDFs in queue order",Icon:Files,ext:"pdf",multiple:true,accept:"pdf"},
  {id:"images-pdf",zh:"图片合并 PDF",en:"Images to PDF",detail:"每张图片一页，可调整页序",english:"One image per page, in queue order",Icon:FileImage,ext:"pdf",multiple:true,accept:"image"},
  {id:"split-pdf",zh:"拆分 PDF",en:"Split PDF",detail:"按页码或每 N 页拆分，保存为 ZIP",english:"Split by pages or groups, save as ZIP",Icon:Scissors,ext:"zip",multiple:false,accept:"pdf"},
  {id:"pdf-images",zh:"PDF 转 PNG",en:"PDF to PNG",detail:"逐页导出 PNG，保存为 ZIP",english:"Render pages to PNG, save as ZIP",Icon:Image,ext:"zip",multiple:false,accept:"pdf"},
  {id:"pdf-jpg",zh:"PDF 转 JPG",en:"PDF to JPG",detail:"逐页导出 JPG，保存为 ZIP",english:"Render pages to JPEG, save as ZIP",Icon:Image,ext:"zip",multiple:false,accept:"pdf"},
  {id:"pdf-text",zh:"PDF 提取文字",en:"PDF to text",detail:"提取文字层，扫描页自动使用 OCR",english:"Extract text, OCR scanned pages automatically",Icon:FileText,ext:"txt",multiple:false,accept:"pdf"},
  {id:"ocr",zh:"中英文 OCR",en:"Chinese / English OCR",detail:"识别图片和扫描 PDF，本地处理",english:"Recognize images and scanned PDFs locally",Icon:ScanText,ext:"txt",multiple:false,accept:"ocr"},
  {id:"pdf-docx",zh:"PDF 转 Word",en:"PDF to Word",detail:"原生 PDF 尝试保留版式，扫描页重建文字；请核对结果",english:"Layout conversion for native PDFs; OCR text reconstruction for scans",Icon:FileType2,ext:"docx",multiple:false,accept:"pdf"},
  {id:"pdf-xlsx",zh:"PDF 表格转 Excel",en:"PDF tables to Excel",detail:"提取可检测的原生表格；扫描表格尚未支持",english:"Extract detected native tables; scanned tables are not supported yet",Icon:FileSpreadsheet,ext:"xlsx",multiple:false,accept:"pdf"},
  {id:"pdf-html",zh:"PDF 转 HTML",en:"PDF to HTML",detail:"按页导出可编辑文字；不保留原始图片和版式",english:"Editable page text; original images and layout are not retained",Icon:FileText,ext:"html",multiple:false,accept:"pdf"},
  {id:"decrypt-pdf",zh:"密码解密 PDF",en:"Decrypt PDF",detail:"使用你提供的原密码解密，另存为副本",english:"Decrypt with the original password, save a separate copy",Icon:LockKeyhole,ext:"pdf",multiple:false,accept:"pdf"},
  {id:"rotate-pdf",zh:"旋转 PDF 页面",en:"Rotate PDF pages",detail:"按 90°、180° 或 270° 旋转全部或指定页面",english:"Rotate all or selected pages by 90°, 180° or 270°",Icon:RotateCw,ext:"pdf",multiple:false,accept:"pdf"},
  {id:"extract-pages",zh:"提取 PDF 页面",en:"Extract PDF pages",detail:"将选定的页码另存为一个 PDF",english:"Save selected pages as a separate PDF",Icon:Copy,ext:"pdf",multiple:false,accept:"pdf"},
  {id:"delete-pages",zh:"删除 PDF 页面",en:"Delete PDF pages",detail:"移除指定页面并另存副本，保留原文件",english:"Remove selected pages and save a new copy",Icon:Trash2,ext:"pdf",multiple:false,accept:"pdf"},
  {id:"reorder-pages",zh:"重排 PDF 页面",en:"Reorder PDF pages",detail:"输入完整的新页序，如 3,1,2",english:"Enter the complete new page order, e.g. 3,1,2",Icon:ListOrdered,ext:"pdf",multiple:false,accept:"pdf"},
  {id:"create-zip",zh:"文件压缩 ZIP",en:"Create ZIP",detail:"将任意普通文件打包；同名文件自动编号",english:"Archive regular files; duplicate names are numbered",Icon:Archive,ext:"zip",multiple:true,accept:"any"},
  ...[
    ["create-7z", "7Z", "7z"], ["create-tar", "TAR", "tar"], ["create-tgz", "TAR.GZ", "tar.gz"],
    ["create-tbz2", "TAR.BZ2", "tar.bz2"], ["create-txz", "TAR.XZ", "tar.xz"],
  ].map(([id, name, ext]) => ({id, zh:`文件压缩 ${name}`, en:`Create ${name}`, detail:"将普通文件打包，同名文件自动编号", english:"Archive regular files; duplicate names are numbered", Icon:Archive, ext, multiple:true, accept:"any"})),
  {id:"extract-zip",zh:"解压压缩包",en:"Extract archive",detail:"ZIP、7Z、RAR、TAR、GZ、BZ2、XZ；暂不支持加密和分卷",english:"ZIP, 7Z, RAR, TAR, GZ, BZ2, XZ; encrypted and split volumes are unsupported",Icon:FolderOpen,ext:"",multiple:false,accept:"archive"},
  {id:"zip-images-pdf",zh:"ZIP 图片转 PDF",en:"ZIP images to PDF",detail:"按文件名自然排序合并图片（1、2、10）",english:"Merge archived images in natural filename order (1, 2, 10)",Icon:FileImage,ext:"pdf",multiple:false,accept:"zip"},
];

export const isArchiveOperation = (id:string) => id.startsWith("create-") || ["extract-zip","zip-images-pdf"].includes(id);

export type ToolCategory = 'all' | 'pages' | 'convert' | 'archive';
export const toolCategory = (id: string): Exclude<ToolCategory,'all'> => isArchiveOperation(id) ? 'archive' : ['merge-pdf','split-pdf','rotate-pdf','extract-pages','delete-pages','reorder-pages','decrypt-pdf'].includes(id) ? 'pages' : 'convert';
export const requiresPageSelection = (id: string) => ['extract-pages','delete-pages','reorder-pages'].includes(id);
