import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ArrowUpRight, X, ShieldCheck } from 'lucide-react';
import { useLabel } from '../i18n/enhanced';
import { operations, toolCategory, type ToolCategory } from '../tools/operations';
import ToolWorkspace from '../tools/ToolWorkspace';
export default function Tools() {
  const label=useLabel();const [params,setParams]=useSearchParams();
  const [query,setQuery]=useState('');const [category,setCategory]=useState<ToolCategory>('all');
  const operation=operations.find(op=>op.id===params.get('tool'));
  const categories:[ToolCategory,string,string][]=[['all','所有工具','All tools'],['pages','PDF 整理','PDF organization'],['convert','转换与 OCR','Conversion & OCR'],['archive','压缩与解压','Archives']];
  if(operation) return <ToolWorkspace key={operation.id} operation={operation.id} onBack={()=>setParams({})}/>;
  const needle=query.trim().toLocaleLowerCase().replace(/\s/g,'');
  const filtered=operations.filter(op=>(category==='all'||toolCategory(op.id)===category)&&`${op.zh} ${op.en} ${op.detail} ${op.english}`.toLocaleLowerCase().replace(/\s/g,'').includes(needle));
  return <div className="page-shell">
    <header className="page-heading"><span className="eyebrow">LOCAL TOOLBOX</span><div className="flex flex-wrap items-center justify-between gap-3"><h1>{label('每个文件，都有好办法','A tool for every task')}</h1><span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1.5 text-xs text-brand-600"><ShieldCheck size={14}/>{label('文件在本机处理','Processed on your Mac')}</span></div><p>{label('选择一个工具，添加文件，处理后预览和保存。','Choose a tool, add your files, then preview and save the results.')}</p></header>
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-5 py-4 shadow-sm"><Search className="shrink-0 text-[rgb(var(--muted))]" size={20}/><input aria-label={label('搜索工具','Search tools')} className="min-w-0 flex-1 bg-transparent text-sm outline-none select-text" placeholder={label('搜索工具，如 合并、旋转、OCR、7Z…','Find a tool: merge, rotate, OCR, 7Z…')} value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="tool-button p-1" aria-label={label('清空搜索','Clear search')} onClick={()=>setQuery('')}><X size={16}/></button>}</div>
    <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label={label('工具分类','Tool categories')}>{categories.map(([id,zh,en])=><button key={id} aria-pressed={category===id} onClick={()=>setCategory(id)} className={`rounded-full border px-4 py-2 text-sm transition-colors ${category===id?'border-brand-500 bg-brand-500 text-white':'border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--muted))] hover:border-brand-400'}`}>{label(zh,en)}</button>)}<span className="ml-auto text-xs text-[rgb(var(--muted))]">{filtered.length} {label('个工具','tools')}</span></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(op=>{
      const color=toolCategory(op.id)==='archive'?'bg-amber-500/10 text-amber-600':toolCategory(op.id)==='pages'?'bg-brand-500/10 text-brand-600':'bg-blue-500/10 text-blue-600';
      return <button aria-label={label(op.zh,op.en)} key={op.id} onClick={()=>setParams({tool:op.id})} className="group rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500"><div className="mb-4 flex items-start justify-between"><span className={`inline-flex rounded-xl p-2.5 ${color}`}><op.Icon size={23}/></span><ArrowUpRight size={16} className="text-[rgb(var(--muted))] opacity-0 transition-opacity group-hover:opacity-100"/></div><h2 className="text-sm font-semibold">{label(op.zh,op.en)}</h2><p className="mt-2 text-xs leading-relaxed text-[rgb(var(--muted))]">{label(op.detail,op.english)}</p></button>;
    })}</div>
    {!filtered.length&&<div className="py-16 text-center"><Search size={30} className="mx-auto mb-4 text-[rgb(var(--muted))]"/><h2 className="font-semibold">{label('没有找到匹配工具','No matching tools')}</h2><p className="mt-2 text-sm text-[rgb(var(--muted))]">{label('试试其他关键词，或切换到所有工具。','Try another keyword or switch to All tools.')}</p><button className="tool-button mt-4" onClick={()=>{setCategory('all');setQuery('');}}>{label('显示所有工具','Show all tools')}</button></div>}
  </div>;
}
