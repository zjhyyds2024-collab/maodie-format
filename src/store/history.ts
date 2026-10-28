import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConvertOptions } from '../converters/types';
export interface HistoryEntry {
  id: string; kind: 'conversion' | 'tool'; name: string; inputPaths: string[];
  target: string; options?: ConvertOptions; pages?: string; groupSize?: number; rotation?: number;
  startedAt: number; finishedAt: number; status: 'done' | 'error' | 'cancelled';
  outputPath?: string; savedPath?: string; outputSize?: number; isDirectory?: boolean;
  outputExtension?: string; error?: string; warnings?: string[];
}
interface HistoryState {
  entries: HistoryEntry[];
  put: (entry: HistoryEntry) => void;
  updateSaved: (id: string, path: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}
// Explicit projection keeps passwords and file contents outside persistent history.
export function cleanEntry(e: HistoryEntry): HistoryEntry {
  return { id:e.id, kind:e.kind, name:e.name, inputPaths:[...e.inputPaths], target:e.target,
    options:e.options ? { quality:e.options.quality, audioBitrate:e.options.audioBitrate, sampleRate:e.options.sampleRate, preserveMetadata:e.options.preserveMetadata } : undefined,
    pages:e.pages, groupSize:e.groupSize, rotation:e.rotation, startedAt:e.startedAt, finishedAt:e.finishedAt, status:e.status,
    outputPath:e.outputPath, savedPath:e.savedPath, outputSize:e.outputSize, isDirectory:e.isDirectory,
    outputExtension:e.outputExtension, error:e.error, warnings:e.warnings ? [...e.warnings] : undefined };
}
export const useHistoryStore = create<HistoryState>()(persist((set) => ({
  entries: [],
  put: (entry) => set(s => ({entries: [cleanEntry(entry), ...s.entries.filter(e => e.id !== entry.id)].sort((a,b)=>b.finishedAt-a.finishedAt).slice(0,100)})),
  updateSaved: (id,path) => set(s=>({entries:s.entries.map(e=>e.id===id?{...e,savedPath:path}:e)})),
  remove: id=>set(s=>({entries:s.entries.filter(e=>e.id!==id)})),
  clear:()=>set({entries:[]}),
}), { name:'vert-enhanced-history', version:1, partialize:s=>({entries:s.entries}),
  merge:(persisted,current)=>{ const entries=(persisted as {entries?:HistoryEntry[]})?.entries;
    return {...current,entries:Array.isArray(entries)?entries.filter(e=>e && typeof e.id==='string' && Array.isArray(e.inputPaths) && ['done','error','cancelled'].includes(e.status)).slice(0,100).map(cleanEntry):[]}; },
}));
export function formatSize(bytes?: number) { if (bytes == null) return '—'; if (bytes<1024) return `${bytes} B`; if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1048576).toFixed(1)} MB`; }
