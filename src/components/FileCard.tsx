import { useEffect, useState } from "react";
import { Download, Trash2, X, FolderOpen, RotateCcw, Eye, FileImage, FileAudio, FileVideo, FileText, FileArchive, ArrowRight, CheckCircle2, Circle, AlertCircle, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { isEncryptedAudio } from "../converters/formats";
import type { ConvertFile } from "../converters/types";
import FormatDropdown from "./FormatDropdown";
import ProgressBar from "./ProgressBar";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store";
import { useLabel } from "../i18n/enhanced";
import { outputFilename, defaultSavePath, errorMessage, chooseDirectory, saveInDirectory } from "../converters/tasks";

import Preview from "./Preview";

function formatBytes(bytes: number): string { if (bytes === 0) return "—"; if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`; return `${(bytes/1048576).toFixed(1)} MB`; }

export default function FileCard({ file }: { file: ConvertFile }) {
  const { t } = useTranslation(); const label = useLabel();
  const store = useAppStore(); const [preview,setPreview]=useState(false); const [, tick] = useState(0);
  const isConverting = file.status === "converting", isDone = file.status === "done", isError = file.status === "error";
  useEffect(() => { if (!isConverting) return; const timer = setInterval(() => tick(n => n+1), 1000); return () => clearInterval(timer); }, [isConverting]);
  const FileIcon = ({image:FileImage, audio:FileAudio, video:FileVideo, archive:FileArchive, document:FileText, pdf:FileText})[file.category];
  const statusText = {idle:label("等待转换", "Waiting"), converting:label("正在转换", "Converting"), done:label("已完成", "Completed"), error:label("转换失败", "Failed"), cancelled:label("已取消", "Cancelled")}[file.status];
  const StatusIcon = isConverting ? LoaderCircle : isDone ? CheckCircle2 : isError ? AlertCircle : Circle;
  const damagedSource = /improper image header|invalid data found when processing input|moov atom not found|cannot identify image file/i.test(file.error ?? '');
  const elapsed = file.startedAt ? Math.max(0, Math.floor(((file.finishedAt ?? Date.now()) - file.startedAt) / 1000)) : null;
  const handleDownload = async () => {
    if (!file.outputPath) return;
    try {
      if (file.isDirectory) {
        const directory=await chooseDirectory(); if (!directory) return;
        const savedPath=await saveInDirectory(file.outputPath,directory,outputFilename(file.name,"",true));store.updateFile(file.id,{savedPath});return;
      }
      const actual=file.outputExtension ?? file.targetFormat;
      const savePath = await save({ defaultPath: defaultSavePath(outputFilename(file.name, actual)), filters: [{ name: actual.toUpperCase(), extensions: [actual] }] });
      if (savePath) { await invoke("save_file", { from: file.outputPath, to: savePath }); store.updateFile(file.id, {savedPath:savePath}); store.addToast(label("已保存", "File saved"), "success"); }
    } catch (error) { store.addToast(errorMessage(error), "error"); }
  };
  return <div className={clsx("queue-file", `queue-file-${file.status}`)} data-status={file.status}>
    <div className="queue-file-main">
      <div className={`queue-file-icon queue-icon-${file.category}`} aria-hidden="true"><FileIcon size={23}/></div>
      <div className="queue-file-info"><p className="truncate text-sm font-medium" title={file.filePath}>{file.name}</p><p className="mt-1 text-xs text-[rgb(var(--muted))]">{formatBytes(file.sizeBytes)} · {file.extension.toUpperCase()} · {label({image:"图片",audio:"音频",video:"视频",document:"文档",pdf:"PDF",archive:"压缩包"}[file.category], file.category)} {elapsed !== null && `· ${elapsed}s`}</p></div>
      <span className="queue-file-status"><StatusIcon size={12} className={isConverting ? "animate-spin" : ""}/>{statusText}</span>
      <div className="queue-file-actions">
        {!isConverting && <ArrowRight size={13} className="queue-format-arrow" aria-hidden="true"/>}

        {!isConverting && <FormatDropdown category={file.category} extension={file.extension} allowedFormats={file.allowedFormats} value={file.targetFormat} onChange={fmt => store.setTargetFormat(file.id, fmt)} disabled={isDone || store.batchRunning}/>}
        {isDone && <><button className="tool-button text-xs" title={label("预览结果","Preview result")} onClick={()=>setPreview(true)}><Eye size={14}/>{label("预览","Preview")}</button><button onClick={handleDownload} className="tool-button text-xs"><Download size={13}/>{t("convert.download")}</button><button title={label("在 Finder 显示", "Reveal in Finder")} className="tool-button" onClick={() => { void invoke("reveal_file", {path:file.savedPath ?? file.outputPath}).catch(e => store.addToast(errorMessage(e), "error")); }}><FolderOpen size={14}/></button></>}
        {isConverting ? <button className="tool-button" title={t("convert.cancel")} onClick={() => { void invoke("cancel_job", {jobId:file.id}).catch(e => store.addToast(errorMessage(e), "error")); }}><X size={16}/></button> : <>
          {(isError || file.status === "cancelled" || isDone) && <button className="tool-button" disabled={store.batchRunning} title={label("重新转换", "Convert again")} onClick={() => store.updateFile(file.id, {status:"idle",error:undefined,outputPath:undefined,savedPath:undefined,warnings:undefined,startedAt:undefined,finishedAt:undefined,progress:0})}><RotateCcw size={14}/></button>}
          <button className="tool-button" onClick={() => store.removeFile(file.id)} title={t("convert.remove")}><Trash2 size={14}/></button></>}
      </div>
    </div>
    {isEncryptedAudio(file.extension) && file.status === "idle" && <p className="text-xs text-[rgb(var(--muted))]">{label("还原原始音频可保留原编码；选择其他格式会转码。", "Original audio keeps the source encoding; other formats transcode.")}</p>}
    {isConverting && <><div className="text-xs text-[rgb(var(--muted))]">{file.stage} {file.progress > 0 && `${Math.floor(file.progress)}%`}</div>{file.progress > 0 ? <ProgressBar value={file.progress}/> : <div className="h-1 rounded bg-brand-500/20 animate-pulse"/>}</>}
    {file.error && <div role={isError ? "alert" : undefined} className={`queue-file-message text-xs select-text ${isError ? "text-red-600 dark:text-red-400" : "text-[rgb(var(--muted))]"}`}>
      {damagedSource ? <><p>{label("源文件可能损坏，或内容与扩展名不符。请确认文件能正常打开后重试。", "The source may be damaged or have the wrong extension. Check that it opens normally, then retry.")}</p><details className="queue-error-details"><summary>{label("错误详情", "Error details")}</summary><p>{file.error}</p></details></> : <p>{file.error}</p>}
    </div>}
    {file.warnings?.map((warning,i) => <p key={i} className="queue-file-message text-xs text-amber-700 dark:text-amber-400 select-text">{warning}</p>)}
    {isDone && <p className="text-xs text-[rgb(var(--muted))]">{label("结果大小：","Result size: ")}{formatBytes(file.outputSizeBytes ?? 0)}</p>}
    {preview && file.outputPath && <Preview target={{path:file.savedPath??file.outputPath,name:file.name,originalPath:file.filePath,inputSize:file.sizeBytes,outputSize:file.outputSizeBytes,isDirectory:file.isDirectory}} onClose={()=>setPreview(false)}/>}
    {file.savedPath && <p className="truncate text-xs text-green-700 dark:text-green-400" title={file.savedPath}>{label("已保存：", "Saved: ")}{file.savedPath}</p>}
  </div>;
}
