import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { APP_VERSION, FEEDBACK_EMAIL } from '../appInfo';
import { useLabel } from '../i18n/enhanced';
import { errorMessage } from '../converters/tasks';
export default function Feedback() {
  const label=useLabel();const [kind,setKind]=useState('suggestion');const [text,setText]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [opened,setOpened]=useState(false);
  const send=async()=>{
    if(!text.trim()||busy)return;setBusy(true);setError('');setOpened(false);
    try{await invoke('open_feedback',{subject:`耄耋格式 ${APP_VERSION} · ${kind==='bug'?label('问题反馈','Bug report'):label('功能建议','Suggestion')}`,body:`${text.trim()}\n\n耄耋格式 ${APP_VERSION}`});setOpened(true);}
    catch(e){setError(errorMessage(e));}finally{setBusy(false);}
  };
  return <form className="space-y-4" onSubmit={e=>{e.preventDefault();void send();}}>
    <p className="text-sm text-[rgb(var(--muted))]">{label('反馈接收邮箱：','Send feedback to: ')}<span className="select-text">{FEEDBACK_EMAIL}</span></p>
    <label className="block text-sm">{label('反馈类型','Feedback type')}<select aria-label={label('反馈类型','Feedback type')} className="select-field mt-2 w-full" value={kind} onChange={e=>setKind(e.target.value)}><option value="suggestion">{label('功能建议','Suggestion')}</option><option value="bug">{label('问题反馈','Bug report')}</option></select></label>
    <label className="block text-sm">{label('内容','Message')}<textarea aria-label={label('反馈内容','Feedback message')} required maxLength={5000} rows={6} className="select-field mt-2 w-full select-text resize-y" value={text} onChange={e=>{setText(e.target.value);setOpened(false);}} placeholder={label('描述你的建议，或遇到问题时的操作步骤…','Describe your suggestion or steps to reproduce the issue…')}/></label>
    <p className="text-xs leading-relaxed text-[rgb(var(--muted))]">{label('将打开默认邮件应用的草稿，由你确认发送。不会自动附加文件、文件路径或任务记录。也可使用上面的邮箱手动发送。','Opens a draft in your default mail app for you to review and send. Files, paths and task history are not attached automatically. You can also email the address above manually.')}</p>
    {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}{opened&&<p role="status" className="text-sm text-brand-600">{label('邮件草稿已打开，请在邮件应用中确认发送。','Draft opened. Review and send it in your mail app.')}</p>}
    <div className="flex justify-end"><button disabled={!text.trim()||busy} className="primary-button" type="submit">{busy?label('正在打开','Opening'):label('打开邮件草稿','Open email draft')}</button></div>
  </form>;
}
