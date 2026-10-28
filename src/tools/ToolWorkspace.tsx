import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { Plus, ArrowUp, ArrowDown, X, Play, Square, FolderOpen, Download, CheckCircle2, AlertCircle, Eye, ArrowLeft } from "lucide-react";
import { useLabel } from "../i18n/enhanced";
import { useAppStore } from "../store";
import { chooseDirectory, defaultSavePath, errorMessage, saveInDirectory } from "../converters/tasks";
import type { ConversionResult } from "../converters/tasks";
import { detectCategory } from "../converters/formats";

import { useLocation } from "react-router-dom";
import { useHistoryStore, type HistoryEntry } from "../store/history";
import Preview, { type PreviewTarget } from "../components/Preview";

import { operations, isArchiveOperation, requiresPageSelection } from "./operations";

interface ToolResult extends ConversionResult { historyId?:string; name: string; savedPath?: string; error?: string }
export default function ToolWorkspace({operation, onBack}: {operation:string; onBack:()=>void}) {
  const location=useLocation(); const [preview,setPreview]=useState<PreviewTarget>();
  const label=useLabel(); const settings=useAppStore(s=>s.settings); const toast=useAppStore(s=>s.addToast);
  const [paths,setPaths]=useState<string[]>([]);
  const [rotation,setRotation]=useState(90);
  const [pages,setPages]=useState(""); const [password,setPassword]=useState(""); const [group,setGroup]=useState(1); const [running,setRunning]=useState(false); const [saving,setSaving]=useState(false);
  const [results,setResults]=useState<ToolResult[]>([]); const [stage,setStage]=useState(""); const [percent,setPercent]=useState<number|null>(null);
  const [started,setStarted]=useState<number>(); const [ended,setEnded]=useState<number>(); const [,tick]=useState(0);
  const active=useRef<string|null>(null); const stopped=useRef(false); const busyRef=useRef(false);
  const selected=operations.find(op=>op.id===operation)!;
  useEffect(()=>{
    const retry=(location.state as {retry?:HistoryEntry}|null)?.retry;
    if(!retry || !operations.some(op=>op.id===retry.target))return;
    setRotation(retry.rotation??90);setPaths([...retry.inputPaths]);setPages(retry.pages??'');setGroup(retry.groupSize??1);setPassword('');
    window.history.replaceState({...window.history.state,usr:null},'');
  },[location.state]);
  const archiveMode=isArchiveOperation(operation);
  const addPaths=(incoming:string[])=>{
    if (busyRef.current) return;
    const valid=incoming.filter(path=> {
      const type=detectCategory(path);
      return ["any","zip","archive"].includes(selected.accept) ? (selected.accept==="any" || (selected.accept==="zip" ? path.toLowerCase().endsWith(".zip") : type==="archive")) : selected.accept==="image" ? type==="image" : selected.accept==="ocr" ? type==="image"||type==="pdf" : type==="pdf";
    });
    if (valid.length!==incoming.length) toast(label("已跳过不符合当前工具的文件。", "Files incompatible with this tool were skipped."),"error");
    setPaths(old=>[...new Set([...old,...valid])]);
  };
  useEffect(()=>{
    let disposed=false; let remove:(()=>void)|undefined;
    void listen<{paths:string[]}>("tauri://drag-drop",event=>addPaths(event.payload.paths)).then(fn=>{if(disposed)fn();else remove=fn;}).catch(()=>{});
    return ()=>{disposed=true;remove?.();};
    // The drop filter follows the selected operation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[operation]);
  useEffect(()=>{
    const sub=listen<{job_id:string;stage:string;current?:number;total?:number}>("conversion-progress",({payload})=>{
      if(payload.job_id!==active.current)return;
      setStage(payload.stage); setPercent(payload.total ? (payload.current??0)/payload.total*100 : null);
    });
    return ()=>{void sub.then(fn=>fn()).catch(()=>{});};
  },[]);
  useEffect(()=>{if(!running)return;const timer=setInterval(()=>tick(n=>n+1),1000);return ()=>clearInterval(timer);},[running]);
  useEffect(()=>()=>{stopped.current=true;useAppStore.getState().setToolsRunning(false);if(active.current)void invoke("cancel_job",{jobId:active.current}).catch(()=>{});},[]);
  const add=async()=>{
    try{const value=await open({multiple:true});if(value)addPaths(Array.isArray(value)?value:[value]);}catch(error){toast(errorMessage(error),"error");}
  };
  const move=(index:number,delta:number)=>setPaths(old=>{const list=[...old];[list[index],list[index+delta]]=[list[index+delta],list[index]];return list;});
  const run=async()=>{
    if(running||!paths.length)return;
    setRunning(true);useAppStore.getState().setToolsRunning(true);busyRef.current=true;setStarted(Date.now());setEnded(undefined);setResults([]);stopped.current=false;
    const groups=selected.multiple?[paths]:paths.map(path=>[path]);
    try{
      for(let index=0;index<groups.length;index++){
        if(stopped.current)break;
        const id=crypto.randomUUID();active.current=id;setPercent(null);setStage(label("正在处理", "Processing")+` ${index+1}/${groups.length}`);
        const stem=selected.multiple?operation:(groups[index][0].split("/").pop()??"result").replace(/\.[^.]+$/,"");
        const operationName=label(selected.zh,selected.en).replace(/[/\\:]/g,"-");
        const name=`${selected.multiple?operationName:`${stem}-${operationName}`}${selected.ext?"."+selected.ext:""}`;
        const entry:HistoryEntry={id,kind:'tool',name:groups[index].length===1?groups[index][0].split('/').pop()??name:name,inputPaths:[...groups[index]],target:operation,pages:pages||undefined,groupSize:group,rotation:operation==="rotate-pdf"?rotation:undefined,startedAt:Date.now(),finishedAt:Date.now(),status:'error'};
        try{
          const output=await invoke<ConversionResult>("document_tool",{request:{operation,...(operation==="rotate-pdf"?{rotation}:{}),input_paths:groups[index],pages:pages||null,group_size:group,job_id:id,password:operation==="decrypt-pdf"?password:null}});
          const record:ToolResult={...output,name,historyId:id};
          if(settings.outputDirectory){
            try{record.savedPath=await saveInDirectory(output.output_path,settings.outputDirectory,name);}catch(error){record.warnings=[...(record.warnings??[]),label("转换完成，但自动保存失败：", "Converted; automatic save failed: ")+errorMessage(error)];}
          }
          Object.assign(entry,{status:'done',outputPath:output.output_path,savedPath:record.savedPath,outputSize:output.size_bytes,outputExtension:output.output_extension,isDirectory:output.is_directory,warnings:record.warnings});
          setResults(old=>[...old,record]);
        }catch(error){const message=errorMessage(error);entry.error=message;entry.status=/取消|cancel/i.test(message)?'cancelled':'error';setResults(old=>[...old,{name,error:message,output_path:"",size_bytes:0}]);if(entry.status==='cancelled')break;}
        finally{entry.finishedAt=Date.now();useHistoryStore.getState().put(entry);}
      }
    }finally{active.current=null;setRunning(false);useAppStore.getState().setToolsRunning(false);busyRef.current=false;setPassword("");setEnded(Date.now());setStage(label("任务已结束", "Finished"));setPercent(null);}
  };
  const cancel=async()=>{stopped.current=true;if(active.current)try{await invoke("cancel_job",{jobId:active.current});}catch(error){toast(errorMessage(error),"error");}};
  const saveResult=async(result:ToolResult)=>{
    try{if(result.is_directory){const directory=await chooseDirectory();if(!directory)return;const savedPath=await saveInDirectory(result.output_path,directory,result.name);setResults(old=>old.map(item=>item===result?{...item,savedPath}:item));if(result.historyId)useHistoryStore.getState().updateSaved(result.historyId,savedPath);return;}const destination=await save({defaultPath:defaultSavePath(result.name),filters:[{name:selected.ext.toUpperCase(),extensions:[selected.ext.split(".").pop()!]}]});if(destination){await invoke("save_file",{from:result.output_path,to:destination});setResults(old=>old.map(item=>item===result?{...item,savedPath:destination}:item));if(result.historyId)useHistoryStore.getState().updateSaved(result.historyId,destination);}}
    catch(error){toast(errorMessage(error),"error");}
  };
  const saveAll=async()=>{
    setSaving(true);
    try{const directory=await chooseDirectory();if(!directory)return;for(const result of results.filter(r=>!r.error)){const savedPath=await saveInDirectory(result.output_path,directory,result.name);setResults(old=>old.map(item=>item.output_path===result.output_path?{...item,savedPath}:item));if(result.historyId)useHistoryStore.getState().updateSaved(result.historyId,savedPath);}toast(label("全部结果已保存。", "All results saved."),"success");}
    catch(error){toast(errorMessage(error),"error");}finally{setSaving(false);}
  };
  const requiredPages=requiresPageSelection(operation);
  return <div className="mx-auto max-w-4xl px-6 py-8">
    <button className="mb-6 inline-flex items-center gap-2 text-sm text-[rgb(var(--muted))] hover:text-brand-600 disabled:opacity-40" disabled={running||saving} onClick={onBack}><ArrowLeft size={16}/>{label("所有工具", "All tools")}</button>
    <header className="page-heading"><span className="eyebrow">{archiveMode?label('压缩与解压','ARCHIVES'):label('PDF 与文档','PDF & DOCUMENTS')}</span><h1>{label(selected.zh,selected.en)}</h1><p>{label(selected.detail,selected.english)}</p></header>
    <ol className="mb-6 flex flex-wrap gap-5 text-xs text-[rgb(var(--muted))]" aria-label={label('操作步骤','Workflow steps')}>{[[1,label('选择文件','Choose files')],[2,label('设置选项','Set options')],[3,label('保存结果','Save results')]].map(([number,text])=><li key={number} className={`flex items-center gap-2 ${Number(number)===(results.length?3:paths.length?2:1)?'font-semibold text-brand-600':''}`}><span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current">{number}</span>{text}</li>)}</ol>
      <section className="space-y-4">
        <div className="panel">

          <button onClick={add} disabled={running||saving} className="w-full rounded-xl border-2 border-dashed border-[rgb(var(--border))] p-7 text-center hover:border-brand-500 disabled:opacity-40"><Plus className="mx-auto mb-2 text-brand-500" size={25}/><span className="text-sm">{label("点击添加，或将文件拖入窗口", "Add files or drop them into this window")}</span></button>
          {paths.length>0&&<div className="mt-4 max-h-56 space-y-2 overflow-y-auto">{paths.map((path,index)=><div key={path} className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2"><span className="w-5 shrink-0 text-xs text-[rgb(var(--muted))]">{index+1}</span><span className="min-w-0 flex-1 truncate text-sm" title={path}>{path.split("/").pop()}</span>{selected.multiple&&<><button disabled={running||index===0} title={label("上移", "Move up")} className="disabled:opacity-20" onClick={()=>move(index,-1)}><ArrowUp size={15}/></button><button disabled={running||index===paths.length-1} title={label("下移", "Move down")} className="disabled:opacity-20" onClick={()=>move(index,1)}><ArrowDown size={15}/></button></>}<button title={label("移除", "Remove")} disabled={running} onClick={()=>setPaths(old=>old.filter(p=>p!==path))}><X size={15}/></button></div>)}</div>}
          {["split-pdf","pdf-images","pdf-jpg","pdf-text","ocr","rotate-pdf","extract-pages","delete-pages","reorder-pages"].includes(operation)&&<div className="mt-4 flex flex-wrap gap-4"><label className="flex-1 min-w-48 text-xs text-[rgb(var(--muted))]">{operation==="reorder-pages"?label("完整的新页序（每页出现一次）","Complete new page order (each page once)"):requiredPages?label("要处理的页码（必填）","Pages to process (required)"):label("PDF 页码（留空为全部）", "PDF pages (empty = all)")}<input aria-label="PDF pages" maxLength={20000} disabled={running} className="select-field mt-1 w-full" value={pages} onChange={e=>setPages(e.target.value)} placeholder={operation==="reorder-pages"?"3,1,2":"1-3,5"}/></label>{operation==="split-pdf"&&<label className="text-xs text-[rgb(var(--muted))]">{label("每组页数", "Pages per group")}<input aria-label="Pages per group" type="number" min={1} max={10000} disabled={running} className="select-field mt-1 block w-28" value={group} onChange={e=>setGroup(Number(e.target.value))}/></label>}</div>}
          {operation==="rotate-pdf"&&<label className="mt-4 block text-xs text-[rgb(var(--muted))]">{label("顺时针旋转角度","Clockwise rotation")}<select aria-label={label("旋转角度","Rotation angle")} className="select-field mt-1 block" disabled={running} value={rotation} onChange={e=>setRotation(Number(e.target.value))}>{[90,180,270].map(angle=><option key={angle} value={angle}>{angle}°</option>)}</select></label>}
          {operation==="decrypt-pdf"&&<label className="mt-4 block text-xs text-[rgb(var(--muted))]">{label("PDF 原密码（仅用于当前任务）", "Original PDF password (this task only)")}<input aria-label="PDF password" type="password" autoComplete="off" value={password} disabled={running} onChange={e=>setPassword(e.target.value)} className="select-field mt-1 w-full"/></label>}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[rgb(var(--border))] pt-4"><button disabled={running} className="tool-button" onClick={()=>{void chooseDirectory().catch(e=>toast(errorMessage(e),"error"));}}><FolderOpen size={15}/>{label("输出文件夹", "Output folder")}</button><span className="min-w-0 flex-1 truncate text-xs text-[rgb(var(--muted))]" title={settings.outputDirectory}>{settings.outputDirectory??label("未设置 · 完成后手动保存", "Not set · save manually")}</span>{running?<button className="tool-button text-red-500" onClick={cancel}><Square size={14}/>{label("取消任务", "Cancel")}</button>:<button className="primary-button" disabled={!paths.length||saving||(requiredPages&&!pages.trim())||(operation==="split-pdf"&&(!Number.isInteger(group)||group<1))} onClick={run}><Play size={14}/>{label("开始处理", "Start")}</button>}</div>
          {started&&<div className="mt-4 text-xs text-[rgb(var(--muted))]">{stage} · {Math.max(0,Math.floor(((ended??Date.now())-started)/1000))}s {percent!==null&&` · ${Math.floor(percent)}%`}{running&&<div className={`mt-2 h-1 overflow-hidden rounded bg-brand-500/20 ${percent===null?"animate-pulse":""}`}><div className="h-full bg-brand-500" style={{width:percent===null?"30%":`${percent}%`}}/></div>}</div>}
        </div>
        {results.length>0&&<div className="panel"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{label("处理结果", "Results")}</h2><button className="tool-button text-xs" disabled={running||saving||!results.some(r=>!r.error)} onClick={saveAll}><Download size={14}/>{label("保存全部", "Save all")}</button></div><div className="space-y-4">{results.map((result,index)=><div key={index} className="border-t border-[rgb(var(--border))] pt-3"><div className="flex items-center gap-2">{result.error?<AlertCircle size={16} className="shrink-0 text-red-500"/>:<CheckCircle2 size={16} className="shrink-0 text-brand-500"/>}<span className="min-w-0 flex-1 truncate text-sm">{result.name}</span>{!result.error&&<><button className="tool-button text-xs" onClick={()=>setPreview({path:result.savedPath??result.output_path,name:result.name,isDirectory:result.is_directory,outputSize:result.size_bytes})}><Eye size={14}/>{label("预览","Preview")}</button><button className="tool-button text-xs" onClick={()=>saveResult(result)}>{label("保存", "Save")}</button><button className="tool-button" title={label("在 Finder 显示", "Reveal in Finder")} onClick={()=>{void invoke("reveal_file",{path:result.savedPath??result.output_path}).catch(e=>toast(errorMessage(e),"error"));}}><FolderOpen size={14}/></button></>}</div>{result.error&&<p className="mt-2 text-xs text-red-500 select-text">{result.error}</p>}{result.warnings?.map((warning,i)=><p className="mt-2 text-xs text-amber-600 select-text" key={i}>{warning}</p>)}{result.savedPath&&<p className="mt-2 truncate text-xs text-brand-600" title={result.savedPath}>{result.savedPath}</p>}</div>)}</div></div>}
        {["ocr","pdf-text","pdf-docx","pdf-xlsx","pdf-images","pdf-jpg"].includes(operation) && <p className="px-1 text-xs leading-relaxed text-[rgb(var(--muted))]">{label("OCR 输出可编辑文字，不恢复原始排版。PDF 转图片以 144 DPI 渲染。PDF 转 Word 和表格 Excel 为实验功能，请检查结果及处理说明。", "OCR outputs editable text, without reconstructing layout. PDF images render at 144 DPI. PDF to Word / table Excel is experimental; review results and conversion notes.")}</p>}
      </section>
    {preview&&<Preview key={preview.path} target={preview} onClose={()=>setPreview(undefined)}/>}
  </div>;
}
