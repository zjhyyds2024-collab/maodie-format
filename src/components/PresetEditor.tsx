import { useEffect, useRef, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store';
import { usePresetStore } from '../store/presets';
import { resolvePreset, defaultOptions, type EditablePresetId, type PresetOverride } from '../converters/presets';
import { getOutputFormats } from '../converters/formats';
import { useLabel } from '../i18n/enhanced';
import { errorMessage } from '../converters/tasks';
export default function PresetEditor({ id, onClose }: { id: EditablePresetId; onClose: () => void }) {
  const label = useLabel();
  const [initial] = useState(() => resolvePreset(id, usePresetStore.getState().overrides));
  const [name, setName] = useState(label(initial.zh, initial.en));
  const formatInitial = initial.id === 'original' ? '' : initial.format;
  const category = initial.id === 'original' ? 'image' : initial.category;
  const initialOptions = { ...defaultOptions(useAppStore.getState().settings), ...('options' in initial ? initial.options : {}) };
  const [format, setFormat] = useState(formatInitial);
  const [quality, setQuality] = useState(initialOptions.quality ?? 92);
  const [bitrate, setBitrate] = useState(initialOptions.audioBitrate ?? 192);
  const [rate, setRate] = useState(initialOptions.sampleRate ?? 0);
  const [error, setError] = useState('');
  const running = useAppStore(s => s.batchRunning);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  const apply = (value?: PresetOverride) => {
    if (running) return;
    try {
      if (value) usePresetStore.getState().save(id, value);
      else usePresetStore.getState().reset(id);
      const store = useAppStore.getState();
      const counts = store.selectedPreset === id ? store.applyPreset(id) : null;
      store.addToast((value ? label('预设已保存', 'Preset saved') : label('已恢复默认预设', 'Default preset restored')) + (counts && store.files.length ? ` · ${label('应用', 'Applied')} ${counts.applied} · ${label('跳过', 'Skipped')} ${counts.skipped}` : ''), 'success');
      onClose();
    } catch (e) { setError(errorMessage(e)); }
  };
  return <dialog ref={dialog} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} className="preview-dialog max-w-lg" aria-labelledby="edit-preset-title">
    <form onSubmit={e => { e.preventDefault(); apply({ name, format, options: category === 'image' ? { quality } : category === 'audio' ? { audioBitrate: bitrate, sampleRate: rate } : {} }); }}>
      <header className="flex items-center justify-between border-b border-[rgb(var(--border))] p-5"><h2 className="font-semibold" id="edit-preset-title">{label('编辑常用预设', 'Edit quick preset')}</h2><button type="button" onClick={onClose} className="tool-button" aria-label={label('关闭编辑', 'Close editor')}><X size={17}/></button></header>
      <div className="space-y-5 p-5">
        <label className="block text-sm font-medium">{label('预设名称', 'Preset name')}<input aria-label={label("预设名称", "Preset name")} autoFocus required maxLength={60} className="select-field mt-2 w-full select-text" value={name} onChange={e => setName(e.target.value)}/></label>
        <label className="block text-sm font-medium">{label('输出格式', 'Output format')}<select aria-label={label("输出格式", "Output format")} className="select-field mt-2 w-full" value={format} onChange={e => setFormat(e.target.value)}>{getOutputFormats(category).map(f => <option key={f.ext} value={f.ext}>{f.label}</option>)}</select></label>
        {category === 'image' && <label className="block text-sm font-medium">{label('图片质量', 'Image quality')} · {quality}<input aria-label={label("图片质量", "Image quality")} className="mt-3 block w-full accent-green-500" type="range" min={1} max={100} value={quality} onChange={e => setQuality(Number(e.target.value))}/></label>}
        {category === 'audio' && <div className="grid grid-cols-2 gap-4"><label className="text-sm font-medium">{label('音频码率 (kbps)', 'Audio bitrate (kbps)')}<input aria-label={label("音频码率 (kbps)", "Audio bitrate (kbps)")} className="select-field mt-2 w-full" type="number" required min={32} max={512} step={1} value={bitrate} onChange={e => setBitrate(Number(e.target.value))}/></label><label className="text-sm font-medium">{label('采样率 (Hz，0 为自动)', 'Sample rate (Hz, 0 = auto)')}<input aria-label={label("采样率 (Hz)", "Sample rate (Hz)")} className="select-field mt-2 w-full" type="number" required min={0} max={192000} step={1} value={rate} onChange={e => setRate(Number(e.target.value))}/></label></div>}
        <p className="text-xs leading-relaxed text-[rgb(var(--muted))]">{label('修改保存在本机。当前已选中的预设会同步到适用的待处理文件，不影响正在执行或已完成的任务。', 'Changes are stored locally. The selected preset updates compatible pending files; running and completed tasks remain unchanged.')}</p>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgb(var(--border))] p-4"><button type="button" className="tool-button text-xs" disabled={running} onClick={() => apply()}><RotateCcw size={14}/>{label('恢复默认', 'Restore default')}</button><div className="flex gap-2"><button type="button" className="tool-button" onClick={onClose}>{label('取消', 'Cancel')}</button><button type="submit" disabled={running || !name.trim()} className="primary-button">{label('保存预设', 'Save preset')}</button></div></footer>
    </form>
  </dialog>;
}
