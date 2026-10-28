import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, ExternalLink, FolderOpen, LoaderCircle } from 'lucide-react';
import { useLabel } from '../i18n/enhanced';
import { errorMessage } from '../converters/tasks';
import { formatSize } from '../store/history';
interface PreviewData { kind:string; size:number; text?:string; truncated:boolean; bytes?:number[]; pages?:number; audio_info?:{title?:string;artist?:string;album?:string;duration?:number;sample_rate?:number;note?:string} }
export interface PreviewTarget {path:string; name:string; originalPath?:string; inputSize?:number; outputSize?:number; isDirectory?:boolean}
function PreviewContent({path}: {path:string}) {
  const label=useLabel(); const [value,setValue]=useState<PreviewData>(); const [url,setUrl]=useState(''); const [error,setError]=useState('');
  useEffect(()=>{
    let disposed=false, objectURL=''; setValue(undefined);setError('');setUrl('');
    void invoke<PreviewData>('preview_file',{path}).then(data=>{
      if(disposed)return;
      setValue(data);
      if(data.bytes){ objectURL=URL.createObjectURL(new Blob([new Uint8Array(data.bytes)],{type:'image/png'}));setUrl(objectURL); }
    }).catch(e=>{if(!disposed)setError(errorMessage(e));});
    return ()=>{disposed=true;if(objectURL)URL.revokeObjectURL(objectURL);};
  },[path]);
  if(error)return <p role="alert" className="p-6 text-sm text-red-500 select-text">{error}</p>;
  if(!value)return <div className="p-12 flex items-center justify-center gap-2 text-sm text-[rgb(var(--muted))]"><LoaderCircle size={18} className="animate-spin"/>{label('正在生成预览','Generating preview')}</div>;
  return <div className="min-w-0">
    <p className="px-4 py-2 text-xs text-[rgb(var(--muted))]">{formatSize(value.size)}{value.pages ? ` · ${value.pages} ${label('页 · 首页预览','pages · first page')}` : ''}</p>
    {url && <div className="preview-canvas"><img src={url} className="mx-auto max-h-[55vh] max-w-full object-contain" alt={value.kind==='audio'?label('专辑封面','Album cover'):label('文件预览','File preview')}/></div>}
    {value.kind==='audio' && <div className="p-4"><dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm select-text">{(['title','artist','album'] as const).map(key=><div key={key} className="contents"><dt className="text-[rgb(var(--muted))]">{label({title:'歌名',artist:'歌手',album:'专辑'}[key],{title:'Title',artist:'Artist',album:'Album'}[key])}</dt><dd className="break-words">{value.audio_info?.[key]??'—'}</dd></div>)}</dl><p className="mt-4 text-xs text-[rgb(var(--muted))]">{value.audio_info?.duration??0}s{value.audio_info?.sample_rate ? ` · ${value.audio_info.sample_rate} Hz` : ''}</p><p className="mt-3 text-xs text-[rgb(var(--muted))]">{value.audio_info?.note??label('点击“系统打开”可试听。','Use “Open with system” to listen.')}</p></div>}
    {value.kind==='text'  && <><pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-relaxed select-text">{value.text}</pre>{value.truncated && <p className="p-3 text-xs text-amber-600">{label('仅显示前 256 KiB，完整内容请打开文件查看。','Showing first 256 KiB. Open the file for full contents.')}</p>}</>}
    {value.kind==='file' && <p className="p-10 text-sm text-[rgb(var(--muted))]">{label('此格式请使用系统应用打开，或在 Finder 中查看。','Open this format with a system app or view it in Finder.')}</p>}
  </div>;
}
export default function Preview({target,onClose}: {target:PreviewTarget;onClose:()=>void}) {
  const label=useLabel(); const dialog=useRef<HTMLDialogElement>(null); const [compare,setCompare]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{ const node=dialog.current;node?.showModal();return ()=>node?.close();},[]);
  const action=async(command:string)=>{try{await invoke(command,{path:target.path});}catch(e){setError(errorMessage(e));}};
  const delta=target.inputSize && target.outputSize!==undefined ? (1-target.outputSize/target.inputSize)*100 : null;
  return <dialog ref={dialog} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}} className="preview-dialog" aria-labelledby="preview-title">
    <div className="flex items-start justify-between gap-4 border-b border-[rgb(var(--border))] p-5"><div className="min-w-0"><h2 id="preview-title" className="truncate font-semibold">{target.name}</h2><p className="mt-1 text-xs text-[rgb(var(--muted))]">{label('结果预览','Result preview')}{delta!==null && ` · ${delta>=0?label('体积减少','Size reduced'):label('体积增加','Size increased')} ${Math.abs(delta).toFixed(1)}%`}</p></div><button autoFocus onClick={onClose} className="tool-button" aria-label={label('关闭预览','Close preview')}><X size={18}/></button></div>
    <div className="flex flex-wrap items-center gap-2 border-b border-[rgb(var(--border))] p-3">{target.originalPath && !target.isDirectory && <button className="tool-button text-xs" onClick={()=>setCompare(!compare)}>{compare?label('只看结果','Result only'):label('对比原文件','Compare original')}</button>}<button onClick={()=>void action(target.isDirectory?'reveal_file':'open_result')} className="tool-button text-xs"><ExternalLink size={14}/>{label('系统打开','Open with system')}</button><button onClick={()=>void action('reveal_file')} className="tool-button text-xs"><FolderOpen size={14}/>Finder</button></div>
    {error && <p role="alert" className="p-3 text-sm text-red-500">{error}</p>}
    {target.isDirectory?<p className="p-8 text-sm">{label('这是文件夹结果，请在 Finder 中查看。','This result is a folder. View it in Finder.')}</p>:<div className={`grid ${compare?'md:grid-cols-2':''}`}>
      {compare && target.originalPath && <section className="min-w-0 border-r border-[rgb(var(--border))]"><h3 className="px-4 pt-4 text-sm font-medium">{label('原文件','Original')}</h3><PreviewContent path={target.originalPath}/></section>}
      <section className="min-w-0"><h3 className="px-4 pt-4 text-sm font-medium">{label('转换结果','Result')}</h3><PreviewContent path={target.path}/></section>
    </div>}
  </dialog>;
}
