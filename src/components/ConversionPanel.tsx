import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Download, Trash2, FolderOpen, Square, Archive } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store";
import { useLabel } from "../i18n/enhanced";
import { chooseDirectory, saveInDirectory, outputFilename, errorMessage, type ConversionResult } from "../converters/tasks";
import { executeConversion } from "../converters/execution";

export default function ConversionPanel() {
  const { t } = useTranslation(); const label = useLabel();
  const files = useAppStore(s => s.files); const settings = useAppStore(s => s.settings);
  const running = useAppStore(s => s.batchRunning); const setRunning = useAppStore(s => s.setBatchRunning); const [saving, setSaving] = useState(false);
  const addToast = useAppStore(s => s.addToast);
  const doneFiles = files.filter(f => f.status === "done");
  const pending = files.filter(f => ["idle", "error", "cancelled"].includes(f.status));
  const handleConvertAll = async () => {
    if (useAppStore.getState().batchRunning) return;
    setRunning(true);
    try {
      let next=0;
      const worker=async()=>{
        while(!useAppStore.getState().batchStopRequested) {
          const file=pending[next++];if(!file)return;
          if(!useAppStore.getState().files.some(f=>f.id===file.id))continue;
          await executeConversion(file);
        }
      };
      await Promise.all(Array.from({length:settings.maxParallel===1?1:2},worker));
    } finally { setRunning(false); }
  };
  const cancelAll = async () => {
    useAppStore.getState().stopBatch();
    try { await Promise.all(useAppStore.getState().files.filter(f => f.status === "converting").map(f => invoke("cancel_job", { jobId: f.id }))); }
    catch (error) { addToast(errorMessage(error), "error"); }
  };
  const saveAll = async () => {
    setSaving(true);
    try {
      const directory = await chooseDirectory(); if (!directory) return;
      for (const file of doneFiles) {
        if (!file.outputPath) continue;
        const savedPath = await saveInDirectory(file.outputPath, directory, outputFilename(file.name, file.outputExtension ?? file.targetFormat, file.isDirectory));
        useAppStore.getState().updateFile(file.id, { savedPath });
      }
      addToast(label("已保存全部结果，同名文件自动编号。", "Saved all results. Name collisions use numbered filenames."), "success");
    } catch (error) { addToast(errorMessage(error), "error"); }
    finally { setSaving(false); }
  };
  const saveZip=async()=>{
    setSaving(true);
    try {
      const selected=await save({defaultPath:"转换结果.zip",filters:[{name:"ZIP",extensions:["zip"]}]});
      if(!selected)return;
      const entries=doneFiles.filter(f=>f.outputPath&&!f.isDirectory).map(f=>({path:f.outputPath!,name:outputFilename(f.name,f.outputExtension??f.targetFormat)}));
      const result=await invoke<ConversionResult>("zip_conversion_results",{files:entries,jobId:crypto.randomUUID()});
      await invoke("save_file",{from:result.output_path,to:selected});
      addToast(label("ZIP 已保存，同名结果保留并自动编号。","ZIP saved. Duplicate names are preserved with numbers."),"success");
    } catch(error) {addToast(errorMessage(error),"error");}
    finally {setSaving(false);}
  };
  return <div className="workspace-actions space-y-3">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-sm text-[rgb(var(--muted))]">{label("已完成", "Completed")} {doneFiles.length} / {files.length} {running && label(`· 最多同时处理 ${settings.maxParallel??2} 项`, `· up to ${settings.maxParallel??2} at a time`)}</span>
      <div className="flex gap-2">
        <select aria-label={label("并发任务", "Concurrent tasks")} className="select-field concurrency-select" value={settings.maxParallel??2} disabled={running||saving} onChange={e=>useAppStore.getState().updateSettings({maxParallel:Number(e.target.value) as 1|2})}><option value={1}>{label("逐个处理", "One at a time")}</option><option value={2}>{label("同时处理 2 项", "Two at a time")}</option></select>
        {doneFiles.some(f=>!f.isDirectory)&&<button className="tool-button" disabled={saving||running} onClick={()=>void saveZip()}><Archive size={14}/>{label("打包 ZIP", "Save ZIP")}</button>}
        {doneFiles.length > 0 && <button onClick={saveAll} disabled={saving || running} className="tool-button"><Download size={15}/>{saving ? label("正在保存", "Saving") : t("convert.downloadAll")}</button>}
        <button onClick={() => useAppStore.getState().clearFiles()} disabled={running || saving} className="tool-button"><Trash2 size={15}/>{t("convert.removeAll")}</button>
        {running ? <button onClick={cancelAll} className="tool-button text-red-500"><Square size={15}/>{label("停止队列", "Stop queue")}</button> : <button onClick={handleConvertAll} disabled={!pending.length || saving} className="primary-button"><Play size={15}/>{doneFiles.length > 0 && pending.length > 0 ? label("转换未完成项", "Convert unfinished") : t("convert.convertAll")}</button>}
      </div>
    </div>
    <div className="flex items-center gap-3 text-xs text-[rgb(var(--muted))]">
      <button className="inline-flex items-center gap-1 shrink-0 hover:text-brand-500" onClick={() => { void chooseDirectory().catch(e => addToast(errorMessage(e), "error")); }} disabled={running}><FolderOpen size={14}/>{label("输出文件夹", "Output folder")}</button>
      <span className="truncate" title={settings.outputDirectory}>{settings.outputDirectory ?? label("未设置 · 完成后手动保存", "Not set · save results manually")}</span>
      {settings.outputDirectory && <button disabled={running} onClick={() => useAppStore.getState().updateSettings({ outputDirectory: undefined })}>{label("清除", "Clear")}</button>}
    </div>
  </div>;
}
