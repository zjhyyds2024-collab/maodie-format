import { useState } from 'react';
import MusicOptions from '../components/MusicOptions';
import AudioSampleRate from '../components/AudioSampleRate';
import { useLabel } from '../i18n/enhanced';
import Uploader from '../components/Uploader';
import PresetPicker from '../components/PresetPicker';
import { SlidersHorizontal, ShieldCheck, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useAppStore } from '../store';
import ConversionPanel from '../components/ConversionPanel';
import FileCard from '../components/FileCard';
import RecentTasks from '../components/RecentTasks';

export default function Convert() {
  const label = useLabel();
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const settings = useAppStore(s => s.settings);
  const running = useAppStore(s => s.batchRunning);
  const files = useAppStore(s => s.files);
  const done = files.filter(file => file.status === 'done').length;

  return <div className="workspace">
    <header className="workspace-toolbar">
      <div><h1>{label('转换工作台', 'Conversion workspace')}</h1><p>{label('添加文件，选择格式，然后转换。', 'Add files, choose a format, and convert.')}</p></div>
      <div className="workspace-toolbar-actions"><span className="workspace-local"><ShieldCheck size={14}/>{label('本机处理', 'On this Mac')}</span><button className="tool-button inspector-toggle" aria-label={label('显示转换设置', 'Show conversion settings')} aria-expanded={inspectorOpen} aria-controls="conversion-inspector" onClick={()=>setInspectorOpen(open=>!open)}>{inspectorOpen ? <PanelRightClose size={17}/> : <PanelRightOpen size={17}/>}<span>{label('参数', 'Inspector')}</span></button></div>
    </header>
    <div className="workspace-body">
      <div className={`workspace-grid ${inspectorOpen ? "" : "inspector-hidden"}`}>
        <section className="workspace-queue" aria-label={label('文件队列', 'File queue')}>
          <div className="workspace-section-heading"><h2>{label('文件', 'Files')}{files.length > 0 && <span className="queue-count">{files.length}</span>}</h2><span role="status" className="text-xs text-[rgb(var(--muted))]">{running ? label('正在转换…', 'Converting…') : files.length ? label(`已完成 ${done} / ${files.length}`, `${done} of ${files.length} completed`) : label('等待添加文件', 'Ready for files')}</span></div>
          <Uploader compact={files.length > 0}/>
          {!files.length && <p className="upload-footnote">{label('支持图片、音视频与文档。PDF 整理和压缩解压请前往工具箱。', 'Images, audio, video and documents. Find PDF and archive tools in Tools.')}</p>}
          {files.length > 0 && <div className="workspace-file-list">{files.map(file => <FileCard key={file.id} file={file}/>)}</div>}
          {files.length > 0 && <ConversionPanel/>}
          <RecentTasks/>
        </section>
        {inspectorOpen && <aside id="conversion-inspector" className="workspace-inspector" aria-label={label('转换设置', 'Conversion settings')}>
          <div className="inspector-heading"><SlidersHorizontal size={15}/><h2>{label('转换设置', 'Conversion settings')}</h2></div>
          <div className="inspector-section"><PresetPicker compact/></div>
          <section className="inspector-section"><h2 className="text-sm font-semibold">{label('默认参数', 'Default parameters')}</h2><p className="mt-2 text-xs leading-relaxed text-[rgb(var(--muted))]">{label('匹配的文件使用预设参数，其余文件使用默认值。', 'Matching files use the preset; other files use these defaults.')}</p>
            <label className="mt-5 block text-xs"><span className="flex justify-between"><span>{label('图片质量', 'Image quality')}</span><span className="tabular-nums text-[rgb(var(--muted))]">{settings.quality}%</span></span><input aria-label={label('图片质量', 'Image quality')} type="range" min={1} max={100} value={settings.quality} disabled={running} onChange={e => useAppStore.getState().updateSettings({quality: Number(e.target.value)})} className="mt-3 w-full accent-brand-600"/></label>
            <label className="mt-4 block text-xs">{label('音频码率', 'Audio bitrate')}<select className="select-field mt-2 w-full" value={settings.audioBitrate} disabled={running} onChange={e => useAppStore.getState().updateSettings({audioBitrate: Number(e.target.value)})}>{[64,128,192,256,320].map(n => <option key={n} value={n}>{n} kbps</option>)}</select></label>
            <div className="inspector-rate"><span>{label('音频采样率', 'Audio sample rate')}</span><AudioSampleRate value={settings.sampleRate} disabled={running} onChange={value=>useAppStore.getState().updateSettings({sampleRate:value})}/></div>
            <p className="inspector-note">{label('自定义预设可覆盖以上参数。自动采样率优先跟随源文件，受输出编码限制。', 'Custom presets can override these defaults. Auto sample rate follows the source when the encoder supports it.')}</p>
          </section>
          <MusicOptions/>
          <div className="inspector-footer"><ShieldCheck size={14}/><span>{label('文件在本机转换，源文件保留。', 'Processed on this Mac. Originals are kept.')}</span></div>
        </aside>}
      </div>
    </div>
  </div>;
}
