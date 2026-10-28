import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ConvertFile, AppSettings } from "../converters/types";
import { detectCategory, getDefaultOutputFormat, getSourceFormats, isEncryptedAudio } from "../converters/formats";
import { errorMessage } from "../converters/tasks";
import { invoke } from "@tauri-apps/api/core";

import { presetPatch, type PresetId } from "../converters/presets";
import { usePresetStore } from "./presets";
import { useHistoryStore } from "./history";

const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  language: "zh-CN",
  defaultImageFormat: "png",
  defaultAudioFormat: "mp3",
  defaultVideoFormat: "mp4",
  defaultDocumentFormat: "docx",
  quality: 92,
  audioBitrate: 192,
  sampleRate: 0,
  preserveMetadata: true,
  useDefaultsAutomatically: false,
};

interface AppState {
  files: ConvertFile[];
  selectedPreset: PresetId;
  applyPreset: (id: PresetId) => { applied: number; skipped: number };
  retryConversion: (entry: import("./history").HistoryEntry) => Promise<void>;
  batchRunning: boolean;
  toolsRunning: boolean;
  setToolsRunning: (running:boolean) => void;
  batchStopRequested: boolean;
  setBatchRunning: (running: boolean) => void;
  stopBatch: () => void;
  musicAccess: {ekey?:string; keyDatabase?:string};
  setMusicAccess: (value:{ekey?:string;keyDatabase?:string})=>void;
  settings: AppSettings;
  toasts: Toast[];
  addFilePaths: (paths: string[]) => Promise<void>;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  updateFile: (id: string, patch: Partial<ConvertFile>) => void;
  setTargetFormat: (id: string, format: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  addToast: (message: string, type: Toast["type"]) => void;
  removeToast: (id: string) => void;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

function generateId(): string {
  return crypto.randomUUID();
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      files: [],
      selectedPreset: 'original',
      applyPreset: id => {
        let applied=0, skipped=0;
        if(get().batchRunning) return {applied,skipped:get().files.length};
        set(s=>({selectedPreset:id, files:s.files.map(file=>{
          const patch=presetPatch(file,id,s.settings,usePresetStore.getState().overrides);
          if(!patch){skipped++;return file.presetId===id && !["done","converting"].includes(file.status)?{...file,options:undefined,presetId:undefined}:file;} applied++;return {...file,...patch};
        })})); return {applied,skipped};
      },
      retryConversion: async entry => {
        const path=entry.inputPaths[0];
        await invoke('get_file_info',{path});
        const before=new Set(get().files.map(f=>f.id));
        await get().addFilePaths([path]);
        const file=get().files.find(f=>!before.has(f.id));
        if(!file) throw new Error('源文件不可用 / Source file unavailable');
        if(!file.allowedFormats?.includes(entry.target)) {
          get().removeFile(file.id); throw new Error('当前组件不支持原目标格式 / Target unavailable');
        }
        get().updateFile(file.id,{targetFormat:entry.target,options:entry.options,presetId:undefined});
      },
      batchRunning: false,
      toolsRunning:false,
      setToolsRunning:(running)=>set({toolsRunning:running}),
      batchStopRequested: false,
      setBatchRunning: (running) => set({batchRunning:running,...(running?{batchStopRequested:false}:{})}),
      stopBatch: () => set({batchStopRequested:true}),
      musicAccess: {},
      setMusicAccess: value => set({musicAccess:value}),
      settings: DEFAULT_SETTINGS,
      toasts: [],

      addFilePaths: async (paths: string[]) => {
        const { settings } = get();
        try {
          const expanded = await invoke<string[]>("expand_input_paths", {paths});
          if (Array.isArray(expanded)) paths = expanded;
        } catch (error) { get().addToast(errorMessage(error), "error"); return; }
        if (!paths.length) { get().addToast("文件夹中没有支持的文件 / No supported files", "info"); return; }

        const newFiles: ConvertFile[] = [];
        for (const filePath of paths) {
          const name = filePath.split("/").pop() ?? filePath;
          let ext = name.split(".").pop()?.toLowerCase() ?? "";
          if (ext === "kgg") { get().addToast("KGG v5 暂不支持，当前支持 KGM/KGMA/VPR。", "error"); continue; }
          let category = detectCategory(name);
          let sizeBytes = 0;
          let detectedFormats: string[] | undefined;
          try {
            const info = await invoke<{size_bytes:number; extension?:string; category?:string; output_formats?:string[]}>("get_file_info",{path:filePath});
            sizeBytes=info.size_bytes;detectedFormats=info.output_formats;
            if(info.extension && ["image","audio","video","document","pdf","archive"].includes(info.category??"")) { ext=info.extension;category=info.category as ConvertFile["category"]; }
          } catch { /* Conversion will report invalid/missing input; retain known extensions. */ }
          if (!category) { get().addToast(`不支持此文件 / Unsupported file: ${name}`, "error"); continue; }

          const defaultFormatKey = `default${category.charAt(0).toUpperCase() + category.slice(1)}Format` as keyof AppSettings;
          const preferredFormat = settings.useDefaultsAutomatically
            ? (settings[defaultFormatKey] as string)
            : isEncryptedAudio(ext) ? "restore-audio" : getDefaultOutputFormat(category);

          const allowed = getSourceFormats(ext, category).map(f => f.ext).filter(ext => !detectedFormats || detectedFormats.includes(ext));
          if (!allowed.length) { get().addToast(`缺少所需转换组件 / Required engine unavailable: ${name}`, "error"); continue; }
          const remembered = localStorage.getItem(`vert-enhanced-target-${ext}`);
          const targetFormat = remembered && allowed.includes(remembered) ? remembered : allowed.includes(preferredFormat) ? preferredFormat : allowed[0];
          if (!targetFormat) continue;
          newFiles.push({
            id: generateId(),
            filePath,
            name,
            sizeBytes,
            extension: ext,
            category,
            targetFormat,
            allowedFormats: allowed,
            status: "idle" as const,
            progress: 0,
          });
        }

        set((state) => ({ files: [...state.files, ...newFiles.map(file=>({...file,...presetPatch(file,state.selectedPreset,state.settings,usePresetStore.getState().overrides)}))] }));
      },

      removeFile: (id: string) => {
        set((state) => ({ files: state.files.filter((f) => f.id !== id) }));
      },

      clearFiles: () => set({ files: [] }),

      updateFile: (id: string, patch: Partial<ConvertFile>) => {
        const file=get().files.find(f=>f.id===id);
        if(file?.historyId && patch.savedPath) useHistoryStore.getState().updateSaved(file.historyId,patch.savedPath);
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id ? { ...f, ...patch } : f,
          ),
        }));
      },

      setTargetFormat: (id: string, format: string) => {
        const file = get().files.find(f => f.id === id);
        if (file) localStorage.setItem(`vert-enhanced-target-${file.extension}`, format);
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id ? { ...f, targetFormat: format } : f,
          ),
        }));
      },

      updateSettings: (patch: Partial<AppSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...patch },
        }));
      },

      addToast: (message: string, type: Toast["type"]) => {
        const id = generateId();
        set((state) => ({
          toasts: [...state.toasts, { id, message, type }],
        }));
        setTimeout(() => {
          get().removeToast(id);
        }, 4000);
      },

      removeToast: (id: string) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },
    }),
    {
      name: "vert-enhanced-store",
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as { settings?: Partial<AppSettings> };
        // Previous releases exposed no global rate control; retire their implicit 44.1 kHz default.
        const settings = { ...DEFAULT_SETTINGS, ...state.settings };
        if (version === 0 && settings.sampleRate === 44100) settings.sampleRate = 0;
        return { ...state, settings };
      },
      merge: (persisted, current) => ({ ...current, settings: { ...DEFAULT_SETTINGS, ...(persisted as {settings?: Partial<AppSettings>})?.settings } }),
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);
