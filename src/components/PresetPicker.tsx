import { useState } from 'react';
import { Sparkles, Pencil } from 'lucide-react';
import { useAppStore } from '../store';
import { usePresetStore } from '../store/presets';
import { presets, resolvePreset, type PresetId, type EditablePresetId } from '../converters/presets';
import { useLabel } from '../i18n/enhanced';
import PresetEditor from './PresetEditor';
export default function PresetPicker({compact=false}: {compact?:boolean}) {
  const label=useLabel(); const selected=useAppStore(s=>s.selectedPreset); const busy=useAppStore(s=>s.batchRunning);
  const overrides=usePresetStore(s=>s.overrides); const [editing,setEditing]=useState<EditablePresetId>();
  const choose=(id:PresetId)=>{
    const store=useAppStore.getState();const count=store.applyPreset(id);
    if(store.files.length)store.addToast(`${label('已应用','Applied')} ${count.applied} · ${label('跳过','Skipped')} ${count.skipped}`,'info');
  };
  return <section><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-brand-500"/>{label('常用预设','Quick presets')}</h2>
    <div className={compact?'grid gap-2':'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'}>{presets.map(base=>{
      const p=resolvePreset(base.id,overrides); const custom=p.id==='original'?undefined:overrides[p.id];
      const detail=custom ? `${p.id==='original'?'':p.format.toUpperCase()}${custom.options.quality!==undefined?` · ${label('质量','quality')} ${custom.options.quality}`:''}${custom.options.audioBitrate!==undefined?` · ${custom.options.audioBitrate} kbps · ${custom.options.sampleRate ? `${custom.options.sampleRate} Hz` : label("自动采样率","Auto sample rate")}`:''}` : label(p.detail,p.english);
      return <div key={p.id} className="preset-entry relative rounded-xl">
        <button disabled={busy} aria-pressed={selected===p.id} onClick={()=>choose(p.id)} className={`preset-card h-full w-full pr-10 ${selected===p.id?'preset-active':''}`}><span className="block break-words text-sm font-medium">{label(p.zh,p.en)}</span><span className="mt-1 block text-xs text-[rgb(var(--muted))]">{detail}</span></button>
        {p.id!=='original' && <button disabled={busy} className="absolute right-2 top-3 rounded-md p-1.5 text-[rgb(var(--muted))] hover:bg-[rgb(var(--border))]/50 hover:text-brand-600 disabled:opacity-40" aria-label={label('编辑','Edit')+' '+label(p.zh,p.en)} title={label('编辑预设','Edit preset')} onClick={()=>setEditing(p.id as EditablePresetId)}><Pencil size={14}/></button>}
      </div>;
    })}</div>
    {editing && <PresetEditor key={editing} id={editing} onClose={()=>setEditing(undefined)}/>}
  </section>;
}
