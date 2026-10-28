import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../src/store';
import { usePresetStore } from '../../src/store/presets';
import { resolvePreset, validatePreset, presetPatch } from '../../src/converters/presets';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue({ size_bytes: 100, output_formats: ['jpg', 'png', 'webp'] }) }));
beforeEach(() => {
  usePresetStore.setState({ overrides: {} });
  useAppStore.setState({ files: [], selectedPreset: 'original', batchRunning: false });
});
describe('editable presets', () => {
  it('persists clean custom names, formats and bounded quality', async () => {
    usePresetStore.getState().save('jpg', { name: ' My WebP ', format: 'webp', options: { quality: 61 } });
    expect(resolvePreset('jpg', usePresetStore.getState().overrides)).toMatchObject({ zh: 'My WebP', format: 'webp', options: { quality: 61 } });
    const saved = localStorage.getItem('vert-enhanced-presets');
    usePresetStore.setState({ overrides: {} });
    localStorage.setItem('vert-enhanced-presets', saved!);
    await usePresetStore.persist.rehydrate();
    useAppStore.getState().applyPreset('jpg');
    await useAppStore.getState().addFilePaths(['/sample.png']);
    expect(useAppStore.getState().files[0]).toMatchObject({ targetFormat: 'webp', options: { quality: 61 } });
  });
  it('updates pending files, preserves completed snapshots, and restores built-ins', async () => {
    await useAppStore.getState().addFilePaths(['/one.png', '/two.png']);
    useAppStore.getState().applyPreset('jpg');
    const done = useAppStore.getState().files[0];
    useAppStore.getState().updateFile(done.id, { status: 'done' });
    usePresetStore.getState().save('jpg', { name: 'Custom', format: 'webp', options: { quality: 40 } });
    expect(useAppStore.getState().applyPreset('jpg')).toEqual({ applied: 1, skipped: 1 });
    expect(useAppStore.getState().files[0].options?.quality).toBe(88);
    expect(useAppStore.getState().files[1]).toMatchObject({ targetFormat: 'webp', options: { quality: 40 } });
    usePresetStore.getState().reset('jpg');
    useAppStore.getState().applyPreset('jpg');
    expect(useAppStore.getState().files[1]).toMatchObject({ targetFormat: 'jpg', options: { quality: 88 } });
  });
  it('clears stale preset parameters when an edited target is unavailable', async () => {
    await useAppStore.getState().addFilePaths(['/one.png']);
    useAppStore.getState().applyPreset('jpg');
    usePresetStore.getState().save('jpg', { name: 'AVIF', format: 'avif', options: { quality: 40 } });
    expect(useAppStore.getState().applyPreset('jpg').skipped).toBe(1);
    expect(useAppStore.getState().files[0].presetId).toBeUndefined();
    expect(useAppStore.getState().files[0].options).toBeUndefined();
  });
  it('rejects invalid edits and ignores corrupt saved definitions', async () => {
    for (const patch of [{ name: '' }, { name: 'a'.repeat(61) }, { format: 'mp3' }, { options: { quality: 101 } }, { options: { quality: NaN } }]) {
      expect(() => validatePreset('jpg', { name: 'test', format: 'jpg', options: { quality: 88 }, ...patch })).toThrow();
    }
    localStorage.setItem('vert-enhanced-presets', JSON.stringify({ state: { overrides: { jpg: { name: 'bad', format: 'mp3', options: {} }, original: {} } }, version: 1 }));
    await usePresetStore.persist.rehydrate();
    expect(usePresetStore.getState().overrides).toEqual({});
    expect(resolvePreset('jpg').zh).toBe('图片转 JPG');
  });
  it('validates audio bitrate/sample rate and projects only relevant options', () => {
    expect(validatePreset('mp3', { name: 'WAV', format: 'wav', options: { audioBitrate: 256, sampleRate: 48000, quality: 12 } }).options).toEqual({ audioBitrate: 256, sampleRate: 48000 });
    expect(() => validatePreset('mp3', { name: 'bad', format: 'mp3', options: { audioBitrate: 999, sampleRate: 48000 } })).toThrow();
    expect(presetPatch({ status: 'converting' } as never, 'jpg', useAppStore.getState().settings)).toBeNull();
  });
});
