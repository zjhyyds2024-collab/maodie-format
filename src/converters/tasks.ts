import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../store";
export interface ConversionResult { output_path: string; size_bytes: number; warnings?: string[]; output_extension?: string; is_directory?: boolean }
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) return String(error.message);
  if (typeof error === "object" && error !== null && "kind" in error) return String(error.kind);
  return typeof error === "string" ? error : JSON.stringify(error);
}
export async function chooseDirectory(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false, defaultPath: useAppStore.getState().settings.outputDirectory });
  if (typeof selected !== "string") return null;
  useAppStore.getState().updateSettings({ outputDirectory: selected });
  return selected;
}
export async function saveInDirectory(from: string, directory: string, filename: string): Promise<string> {
  return invoke<string>("save_to_directory", { from, directory, filename });
}
export function outputFilename(name: string, format: string, isDirectory=false): string { const stem=name.replace(/\.(?:(?:kgm|vpr)\.flac|[^.]+)$/i, ""); return isDirectory ? `${stem}-解压` : `${stem}.${format}`; }

export function defaultSavePath(filename:string):string { const directory=useAppStore.getState().settings.outputDirectory;return directory?`${directory.replace(/\/$/, "")}/${filename}`:filename; }
