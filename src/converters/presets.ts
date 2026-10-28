import type { ConvertFile, ConvertOptions, AppSettings } from './types';
import { getOutputFormats } from './formats';
export const presets = [
  { id: 'original', zh: '默认参数', en: 'Default settings', detail: '使用设置中的参数', english: 'Use your default settings' },
  { id: 'jpg', zh: '图片转 JPG', en: 'Images to JPG', detail: '通用图片 · 质量 88', english: 'Everyday images · quality 88', category: 'image', format: 'jpg', options: { quality: 88 } },
  { id: 'webp', zh: '图片转 WebP', en: 'Images to WebP', detail: '网页图片 · 质量 82', english: 'Web images · quality 82', category: 'image', format: 'webp', options: { quality: 82 } },
  { id: 'mp3', zh: '音频转 MP3', en: 'Audio to MP3', detail: '通用音频 · 192 kbps', english: 'Everyday audio · 192 kbps', category: 'audio', format: 'mp3', options: { audioBitrate: 192, sampleRate: 0 } },
  { id: 'mp4', zh: '视频转 MP4', en: 'Video to MP4', detail: '切换输出格式', english: 'Change output format', category: 'video', format: 'mp4', options: {} },
  { id: 'pdf', zh: '文档转 PDF', en: 'Documents to PDF', detail: '便于阅读与分享', english: 'Ready to read and share', category: 'document', format: 'pdf', options: {} },
] as const;
export type PresetId = typeof presets[number]['id'];
export type EditablePresetId = Exclude<PresetId, 'original'>;
export interface PresetOverride {
  name: string;
  format: string;
  options: ConvertOptions;
}
export type PresetOverrides = Partial<Record<EditablePresetId, PresetOverride>>;
export function validatePreset(id: string, value: unknown): PresetOverride {
  const base = presets.find(p => p.id === id);
  if (!base || base.id === 'original' || !value || typeof value !== 'object') throw new Error('无效的预设 / Invalid preset');
  const raw = value as Partial<PresetOverride>;
  if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.trim().length > 60) throw new Error('名称需要 1–60 个字符 / Name must contain 1–60 characters');
  if (!getOutputFormats(base.category).some(f => f.ext === raw.format)) throw new Error('目标格式不适用于此类别 / Invalid target format for category');
  const options: ConvertOptions = {};
  const number = (value: unknown, min: number, max: number): number => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error('参数超出允许范围 / Parameter out of range');
    return value;
  };
  if (base.category === 'image') options.quality = number(raw.options?.quality, 1, 100);
  if (base.category === 'audio') {
    options.audioBitrate = number(raw.options?.audioBitrate, 32, 512);
    options.sampleRate = raw.options?.sampleRate == null || raw.options.sampleRate === 0 ? 0 : number(raw.options.sampleRate, 8000, 192000);
  }
  return { name: raw.name.trim(), format: raw.format!, options };
}
export function resolvePreset(id: PresetId, overrides: PresetOverrides = {}) {
  const base = presets.find(p => p.id === id)!;
  if (base.id === 'original') return base;
  const custom = overrides[base.id];
  if (!custom) return base;
  return { ...base, zh: custom.name, en: custom.name, format: custom.format, options: { ...custom.options } };
}
export function defaultOptions(s: AppSettings): ConvertOptions {
  return { quality: s.quality, audioBitrate: s.audioBitrate, sampleRate: s.sampleRate || undefined, preserveMetadata: s.preserveMetadata };
}
export function presetPatch(file: ConvertFile, id: PresetId, settings: AppSettings, overrides: PresetOverrides = {}): Partial<ConvertFile> | null {
  if (file.status === 'done' || file.status === 'converting') return null;
  const preset = resolvePreset(id, overrides);
  if (preset.id === 'original') return { options: undefined, presetId: undefined };
  if (file.category !== preset.category || !file.allowedFormats?.includes(preset.format)) return null;
  return { targetFormat: preset.format, options: { ...defaultOptions(settings), ...preset.options }, presetId: id };
}
