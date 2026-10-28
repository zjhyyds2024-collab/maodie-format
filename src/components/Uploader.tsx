import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Upload, FolderOpen } from "lucide-react";
import clsx from "clsx";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { useLabel } from "../i18n/enhanced";
import { errorMessage } from "../converters/tasks";
import { useAppStore } from "../store";

interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

export default function Uploader({compact = false}: {compact?: boolean}) {
  const { t } = useTranslation();
  const label = useLabel();
  const running = useAppStore(s => s.batchRunning);
  const addFilePaths = useAppStore((s) => s.addFilePaths);
  const [isDragging, setIsDragging] = useState(false);

  const handlePaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0 || useAppStore.getState().batchRunning) return;
      try { await addFilePaths(paths); }
      catch (error) { useAppStore.getState().addToast(errorMessage(error), "error"); }
    },
    [addFilePaths],
  );

  // Listen to Tauri native drag-drop events (gives real filesystem paths)
  useEffect(() => {
    let disposed = false;
    const removers: (() => void)[] = [];
    const subscriptions = [
      listen<DragDropPayload>("tauri://drag-drop", event => { setIsDragging(false); if (event.payload.paths?.length) void handlePaths(event.payload.paths); }),
      listen("tauri://drag-enter", () => setIsDragging(true)),
      listen("tauri://drag-leave", () => setIsDragging(false)),
    ];
    subscriptions.forEach(subscription => { void subscription.then(fn => { if (disposed) fn(); else removers.push(fn); }).catch(() => {}); });
    return () => { disposed = true; removers.forEach(fn => fn()); };
  }, [handlePaths]);

  const handleClick = useCallback(async () => {
    if (useAppStore.getState().batchRunning) return;
    try {
      const selected = await open({ multiple: true });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      await handlePaths(paths);
    } catch (error) { useAppStore.getState().addToast(errorMessage(error), "error"); }
  }, [handlePaths]);

  useEffect(() => {
    const openFiles = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        if (!document.querySelector("dialog[open]")) void handleClick();
      }
    };
    window.addEventListener("keydown", openFiles);
    return () => window.removeEventListener("keydown", openFiles);
  }, [handleClick]);

  const chooseFolder = async () => {
    try {
      const selected = await open({directory:true, multiple:false});
      if(typeof selected === "string") await handlePaths([selected]);
    } catch(error) {useAppStore.getState().addToast(errorMessage(error), "error");}
  };

  return (<>
    <button
      type="button"
      onClick={handleClick}
      disabled={running}
      className={clsx(
        "workspace-upload",
        compact && "workspace-upload-compact",
        isDragging
          ? "border-brand-500 bg-brand-500/5"
          : "border-[rgb(var(--border))] hover:border-brand-400 hover:bg-brand-500/5",
      )}
    >
      <div className={clsx("upload-icon", isDragging ? "bg-brand-500/10" : "bg-[rgb(var(--border))]/30")}>
        <Upload size={compact ? 19 : 30} className={clsx("transition-colors", isDragging ? "text-brand-500" : "text-[rgb(var(--muted))]")} />
      </div>
      <div className="text-center">
        <p className="font-semibold text-[rgb(var(--fg))]">{compact ? label("继续添加文件", "Add more files") : t("home.dropFiles")}</p>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">{running ? label("队列完成后可继续添加", "Add files when the queue finishes") : t("home.clickOrDrop")}</p>
      </div>
      <kbd className="upload-shortcut" aria-hidden="true">⌘ O</kbd>
    </button>
    <button type="button" className="folder-import" disabled={running} onClick={()=>void chooseFolder()}><FolderOpen size={13}/>{label("添加文件夹", "Add folder")}<span>{label("包含子文件夹", "Include subfolders")}</span></button>
  </>);
}
