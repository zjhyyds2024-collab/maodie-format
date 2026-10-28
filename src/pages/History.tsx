import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, History as HistoryIcon, Eye, FolderOpen, RotateCcw, Trash2, ArrowUpRight } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useHistoryStore, formatSize, type HistoryEntry } from '../store/history';
import { useAppStore } from '../store';
import { useLabel } from '../i18n/enhanced';
import { operations } from '../tools/operations';
import { errorMessage } from '../converters/tasks';
import Preview, { type PreviewTarget } from '../components/Preview';
export default function History() {
  const label=useLabel();const navigate=useNavigate();const entries=useHistoryStore(s=>s.entries);
  const [query,setQuery]=useState('');const [filter,setFilter]=useState('all');const [preview,setPreview]=useState<PreviewTarget>();const [retrying,setRetrying]=useState(false);const [confirmClear,setConfirmClear]=useState(false);
  const busy=useAppStore(s=>s.batchRunning||s.toolsRunning);
  const statusLabel=(status:string)=>status==='done'?label('已完成','Completed'):status==='cancelled'?label('已取消','Cancelled'):label('失败','Failed');
  const list=entries.filter(e=>(filter==='all'||e.status===filter)&&e.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const retry=async(entry:HistoryEntry)=>{
    if(busy||retrying)return;setRetrying(true);
    try {
      if(entry.kind==='conversion'){await useAppStore.getState().retryConversion(entry);navigate('/convert');}
      else {await Promise.all(entry.inputPaths.map(path=>invoke('get_file_info',{path})));navigate(`/tools?tool=${encodeURIComponent(entry.target)}`,{state:{retry:entry}});}
    } catch(error){useAppStore.getState().addToast(errorMessage(error),'error');}finally{setRetrying(false);}
  };
  return <div className="page-shell">
    <header className="page-heading"><span className="eyebrow">YOUR WORKSPACE</span><h1>{label('任务记录','Task history')}</h1><p>{label('找回结果，或沿用之前的参数再做一次。最近 100 次任务仅保存在本机。','Find results or reuse previous settings. Last 100 tasks are stored locally.')}</p></header>
    <div className="panel mb-5 flex flex-wrap items-center gap-3"><label className="flex min-w-40 flex-1 items-center gap-2"><Search size={17} className="text-[rgb(var(--muted))]"/><input aria-label={label('搜索任务','Search tasks')} className="w-full min-w-0 bg-transparent text-sm outline-none select-text" placeholder={label('搜索文件名…','Search filenames…')} value={query} onChange={e=>setQuery(e.target.value)}/></label><select className="select-field" aria-label={label('筛选状态','Filter status')} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{label('全部状态','All statuses')}</option>{['done','error','cancelled'].map(s=><option value={s} key={s}>{statusLabel(s)}</option>)}</select>
      {confirmClear?<><span className="text-xs">{label('仅删除记录，保留文件。','Remove records only; keep files.')}</span><button className="tool-button text-red-500" onClick={()=>{useHistoryStore.getState().clear();setConfirmClear(false);}}>{label('确认清空','Confirm clear')}</button><button className="tool-button" onClick={()=>setConfirmClear(false)}>{label('取消','Cancel')}</button></>:<button className="tool-button" disabled={!entries.length} onClick={()=>setConfirmClear(true)}><Trash2 size={15}/>{label('清空记录','Clear history')}</button>}
    </div>
    {!list.length?<div className="panel py-16 text-center"><HistoryIcon className="mx-auto mb-4 text-[rgb(var(--muted))]" size={32}/><h2 className="font-semibold">{entries.length?label('没有匹配的任务','No matching tasks'):label('从第一次转换开始','Your work starts here')}</h2><p className="mt-2 text-sm text-[rgb(var(--muted))]">{label('完成、失败和取消的任务会出现在这里。','Completed, failed and cancelled tasks appear here.')}</p><button className="primary-button mt-5" onClick={()=>navigate('/convert')}>{label('添加文件','Add files')}<ArrowUpRight size={15}/></button></div>:<div className="space-y-3">{list.map(entry=>{
      const operation=operations.find(op=>op.id===entry.target);const path=entry.savedPath??entry.outputPath;
      return <article className="panel" key={entry.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={`status-pill ${entry.status==='done'?'text-brand-600':entry.status==='error'?'text-red-500':'text-[rgb(var(--muted))]'}`}>{statusLabel(entry.status)}</span><span className="text-xs text-[rgb(var(--muted))]">{new Date(entry.startedAt).toLocaleString()} · {Math.max(0,(entry.finishedAt-entry.startedAt)/1000).toFixed(1)}s</span></div><h2 className="mt-2 truncate font-medium" title={entry.inputPaths.join('\n')}>{entry.name}</h2><p className="mt-1 text-xs text-[rgb(var(--muted))]">{operation?label(operation.zh,operation.en):(entry.target==="restore-audio"?label("原始音频", "Original audio")+(entry.outputExtension?` (${entry.outputExtension.toUpperCase()})`:""):entry.target.toUpperCase())} · {formatSize(entry.outputSize)} · {entry.savedPath?label('已保存','Saved'):entry.status==='done'?label('临时结果 · 文件可能已失效','Temporary result · may expire'):label('可重新加入','Ready to retry')}</p></div>
        <div className="flex flex-wrap gap-2">{path && <><button className="tool-button" title={label('预览结果','Preview result')} onClick={()=>setPreview({path,name:entry.name,outputSize:entry.outputSize,isDirectory:entry.isDirectory,originalPath:entry.inputPaths.length===1?entry.inputPaths[0]:undefined})}><Eye size={15}/>{label('预览','Preview')}</button><button className="tool-button" title={label('在 Finder 显示','Reveal in Finder')} onClick={()=>void invoke('reveal_file',{path}).catch(e=>useAppStore.getState().addToast(errorMessage(e),'error'))}><FolderOpen size={15}/></button></>}
        <button className="tool-button" disabled={busy||retrying} onClick={()=>void retry(entry)}><RotateCcw size={15}/>{label('重新加入','Add again')}</button><button className="tool-button" title={label('删除记录','Delete record')} onClick={()=>useHistoryStore.getState().remove(entry.id)}><Trash2 size={15}/></button></div></div>
        {entry.error&&<p className="mt-3 select-text text-xs text-red-500">{entry.error}</p>}{entry.warnings?.map((w,i)=><p key={i} className="mt-2 select-text text-xs text-amber-600">{w}</p>)}
      </article>;
    })}</div>}
    {preview&&<Preview key={preview.path} target={preview} onClose={()=>setPreview(undefined)}/>}
  </div>;
}
