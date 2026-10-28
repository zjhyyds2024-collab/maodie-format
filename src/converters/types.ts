export type FileCategory = "image" | "audio" | "video" | "document" | "pdf" | "archive";

export type ConversionStatus =
  | "idle"
  | "converting"
  | "done"
  | "error"
  | "cancelled";

export interface FormatInfo {
  ext: string;
  label: string;
  canInput: boolean;
  canOutput: boolean;
}

export interface ConvertFile {
  id: string;
  filePath: string;
  name: string;
  sizeBytes: number;
  extension: string;
  category: FileCategory;
  targetFormat: string;
  status: ConversionStatus;
  progress: number;
  options?: ConvertOptions;
  presetId?: string;
  historyId?: string;
  outputSizeBytes?: number;
  outputPath?: string;
  error?: string;
  allowedFormats?: string[];
  stage?: string;
  startedAt?: number;
  finishedAt?: number;
  warnings?: string[];
  savedPath?: string;
  outputExtension?: string;
  isDirectory?: boolean;
}

export interface ConvertOptions {
  quality?: number;
  audioBitrate?: number;
  sampleRate?: number;
  preserveMetadata?: boolean;
}

export interface AppSettings {
  maxParallel?: 1 | 2;
  theme: "light" | "dark" | "system";
  language: string;
  defaultImageFormat: string;
  defaultAudioFormat: string;
  defaultVideoFormat: string;
  defaultDocumentFormat: string;
  quality: number;
  audioBitrate: number;
  sampleRate: number;
  preserveMetadata: boolean;
  useDefaultsAutomatically: boolean;
  outputDirectory?: string;
}
