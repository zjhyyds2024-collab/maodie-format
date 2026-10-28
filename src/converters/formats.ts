export const ENCRYPTED_AUDIO_EXTENSIONS = ["ncm", "mflac", "mgg", "mflac0", "mgg0", "mgg1", "mggl", "mmp4", "qmcflac", "qmcogg", "qmc0", "qmc1", "qmc2", "qmc3", "qmc4", "qmc5", "qmc6", "qmc7", "qmc8", "tkm", "bkcmp3", "bkcm4a", "bkcflac", "bkcwav", "bkcape", "bkcogg", "bkcwma", "666c6163", "6d7033", "6f6767", "6d3461", "776176", "kgm", "kgma", "vpr", "kwm"];
export const isEncryptedAudio = (ext:string) => ENCRYPTED_AUDIO_EXTENSIONS.includes(ext.toLowerCase());
import type { FileCategory, FormatInfo } from "./types";

export const IMAGE_FORMATS: FormatInfo[] = [
  { ext: "png", label: "PNG", canInput: true, canOutput: true },
  { ext: "jpg", label: "JPEG", canInput: true, canOutput: true },
  { ext: "webp", label: "WebP", canInput: true, canOutput: true },
  { ext: "gif", label: "GIF", canInput: true, canOutput: true },
  { ext: "bmp", label: "BMP", canInput: true, canOutput: true },
  { ext: "tiff", label: "TIFF", canInput: true, canOutput: true },
  { ext: "avif", label: "AVIF", canInput: true, canOutput: true },
  { ext: "heic", label: "HEIC", canInput: true, canOutput: true },
  { ext: "jxl", label: "JXL", canInput: true, canOutput: true },
  { ext: "ico", label: "ICO", canInput: true, canOutput: true },
  { ext: "svg", label: "SVG", canInput: true, canOutput: false },
  { ext: "psd", label: "PSD", canInput: true, canOutput: true },
  { ext: "exr", label: "EXR", canInput: true, canOutput: true },
  { ext: "hdr", label: "HDR", canInput: true, canOutput: true },
  { ext: "dng", label: "DNG", canInput: true, canOutput: false },
  { ext: "nef", label: "NEF", canInput: true, canOutput: false },
  { ext: "cr2", label: "CR2", canInput: true, canOutput: false },
  { ext: "arw", label: "ARW", canInput: true, canOutput: false },
];

export const AUDIO_FORMATS: FormatInfo[] = [
  ...ENCRYPTED_AUDIO_EXTENSIONS.filter(ext=>ext!=="ncm").map(ext=>({ext,label:ext.toUpperCase(),canInput:true,canOutput:false})),
  { ext: "ncm", label: "NCM（网易云）", canInput: true, canOutput: false },
  { ext: "mp3", label: "MP3", canInput: true, canOutput: true },
  { ext: "wav", label: "WAV", canInput: true, canOutput: true },
  { ext: "flac", label: "FLAC", canInput: true, canOutput: true },
  { ext: "ogg", label: "OGG", canInput: true, canOutput: true },
  { ext: "opus", label: "Opus", canInput: true, canOutput: true },
  { ext: "aac", label: "AAC", canInput: true, canOutput: true },
  { ext: "m4a", label: "M4A", canInput: true, canOutput: true },
  { ext: "wma", label: "WMA", canInput: true, canOutput: true },
  { ext: "aiff", label: "AIFF", canInput: true, canOutput: true },
  { ext: "alac", label: "ALAC", canInput: true, canOutput: false },
  { ext: "mp2", label: "MP2", canInput: true, canOutput: true },
  { ext: "au", label: "AU", canInput: true, canOutput: true },
];

export const VIDEO_FORMATS: FormatInfo[] = [
  { ext: "mp4", label: "MP4", canInput: true, canOutput: true },
  { ext: "mkv", label: "MKV", canInput: true, canOutput: true },
  { ext: "webm", label: "WebM", canInput: true, canOutput: true },
  { ext: "avi", label: "AVI", canInput: true, canOutput: true },
  { ext: "mov", label: "MOV", canInput: true, canOutput: true },
  { ext: "wmv", label: "WMV", canInput: true, canOutput: true },
  { ext: "ts", label: "TS", canInput: true, canOutput: true },
  { ext: "m4v", label: "M4V", canInput: true, canOutput: true },
  { ext: "3gp", label: "3GP", canInput: true, canOutput: true },
  { ext: "ogv", label: "OGV", canInput: true, canOutput: true },
  { ext: "flv", label: "FLV", canInput: true, canOutput: false },
];

export const DOCUMENT_FORMATS: FormatInfo[] = [
  { ext: "docx", label: "DOCX", canInput: true, canOutput: true },
  { ext: "doc", label: "DOC", canInput: true, canOutput: false },
  { ext: "md", label: "Markdown", canInput: true, canOutput: true },
  { ext: "html", label: "HTML", canInput: true, canOutput: true },
  { ext: "rtf", label: "RTF", canInput: true, canOutput: true },
  { ext: "epub", label: "EPUB", canInput: true, canOutput: true },
  { ext: "odt", label: "ODT", canInput: true, canOutput: true },
  { ext: "rst", label: "RST", canInput: true, canOutput: true },
  { ext: "csv", label: "CSV", canInput: true, canOutput: true },
];

DOCUMENT_FORMATS.push(...["txt", "xls", "xlsx", "ods", "ppt", "pptx", "odp", "tsv", "wps", "et", "dps"].map(ext => ({ ext, label: ["wps","et","dps"].includes(ext) ? ext.toUpperCase() + " · 兼容导入" : ext.toUpperCase(), canInput: true, canOutput: !["xls","ppt","tsv","wps","et","dps"].includes(ext) })));
export const PDF_FORMATS: FormatInfo[] = [{ ext: "pdf", label: "PDF", canInput: true, canOutput: false }, { ext: "txt", label: "TXT", canInput: false, canOutput: true }];
DOCUMENT_FORMATS.push({ ext: "pdf", label: "PDF", canInput: false, canOutput: true });
const extraDocuments = ["json","xml","yaml","yml","log","xlsm","wpt","wpd","ett","dpt"];
for (const ext of extraDocuments) DOCUMENT_FORMATS.push({ext,label:ext.toUpperCase(),canInput:true,canOutput:["json","xml","yaml"].includes(ext)});
for (const ext of ["cr3","crw","raf","rw2","orf","pef","srw","3fr","erf","fff","iiq","kdc","mef","mrw","x3f"]) IMAGE_FORMATS.push({ext,label:ext.toUpperCase()+" · RAW",canInput:true,canOutput:false});
export const ARCHIVE_FORMATS:FormatInfo[]=[{ext:"unpack",label:"解压为文件夹 / Extract",canInput:false,canOutput:true},{ext:"pdf",label:"图片合并 PDF",canInput:false,canOutput:true}];
const ALL_INPUT_EXTENSIONS: Record<string, FileCategory> = {};
for (const [category,formats] of Object.entries({image:IMAGE_FORMATS,audio:AUDIO_FORMATS,video:VIDEO_FORMATS,document:DOCUMENT_FORMATS})) for(const format of formats.filter(f=>f.canInput)) ALL_INPUT_EXTENSIONS[format.ext]=category as FileCategory;
ALL_INPUT_EXTENSIONS.pdf="pdf";
for(const ext of ["zip","7z","rar","tar","gz","tgz","bz2","tbz2","xz","txz"]) ALL_INPUT_EXTENSIONS[ext]="archive";
for (const [ext, category] of Object.entries({jpeg:"image",tif:"image",heif:"image",tga:"image",htm:"document",mpeg:"video",mpg:"video",mts:"video",m2ts:"video",m4b:"audio",voc:"audio"})) ALL_INPUT_EXTENSIONS[ext]=category as FileCategory;
export function detectCategory(filename:string):FileCategory|null {return ALL_INPUT_EXTENSIONS[filename.split(".").pop()?.toLowerCase()??""]??null;}
export function getOutputFormats(category:FileCategory):FormatInfo[]{
  const map:Record<FileCategory,FormatInfo[]>={image:IMAGE_FORMATS,audio:AUDIO_FORMATS,video:VIDEO_FORMATS,document:DOCUMENT_FORMATS,pdf:PDF_FORMATS,archive:ARCHIVE_FORMATS};
  return map[category].filter(f=>f.canOutput);
}
export function getDefaultOutputFormat(category:FileCategory):string {return {image:"png",audio:"mp3",video:"mp4",document:"docx",pdf:"txt",archive:"unpack"}[category];}
function formats(extensions:string[],pageImages=false):FormatInfo[]{return extensions.map(ext=>({ext,label:ext==="unpack"?"解压为文件夹 / Extract":pageImages&&["png","jpg"].includes(ext)?`${ext.toUpperCase()} 逐页图片（ZIP）`:ext==="html"&&pageImages?"HTML 网页包（ZIP）":ext.toUpperCase(),canInput:false,canOutput:true}));}
export function getSourceFormats(extension:string,category:FileCategory):FormatInfo[]{
  const ext=extension.toLowerCase();
  if(isEncryptedAudio(ext))return [{ext:"restore-audio",label:"还原原始音频 / Original audio",canInput:false,canOutput:true},...getOutputFormats("audio")];
  if(category==="archive")return ARCHIVE_FORMATS.filter(f=>ext==="zip"||f.ext==="unpack");
  if(category==="pdf")return formats(["txt","docx","xlsx","html","png","jpg"],true);
  if(category==="image")return [...getOutputFormats("image"),...formats(["pdf","txt","mp4","webm"])];
  if(category==="video")return [...getOutputFormats("video"),...getOutputFormats("audio").filter(f=>["mp3","wav","flac","m4a","ogg","aac","opus","wma"].includes(f.ext)),...formats(["gif"])];
  if(ext==="csv")return formats(["xlsx","xls","ods","csv","pdf","html","txt","md","json","xml","yaml","docx","epub"]);
  if(["xls","xlsx","xlsm","ods","tsv","et","ett"].includes(ext))return formats(["xlsx","xls","ods","csv","pdf","html"]);
  if(["ppt","pptx","odp","dps","dpt"].includes(ext))return formats(["pptx","odp","pdf","html","png","jpg"],true);
  if(["doc","docx","odt","rtf","wps","wpt","wpd"].includes(ext))return formats(["docx","odt","rtf","html","md","txt","epub","pdf"]);
  if(["txt","md","html","htm","json","xml","yaml","yml","log"].includes(ext))return formats(["docx","odt","rtf","md","txt","html","rst","epub","pdf","json","xml","yaml","csv"]);
  return getOutputFormats(category);
}
