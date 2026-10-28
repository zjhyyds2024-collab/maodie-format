import { APP_VERSION } from '../appInfo';
import { NavLink } from 'react-router-dom';
import { useAppStore } from '../store';
import { useHistoryStore } from '../store/history';
import { useLabel } from '../i18n/enhanced';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, Settings, ScanText, History, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
export default function Navbar() {
  const {t}=useTranslation();const label=useLabel();
  const busy=useAppStore(s=>s.toolsRunning||s.batchRunning);const files=useAppStore(s=>s.files.length);const count=useHistoryStore(s=>s.entries.length);
  const links=[{to:'/',label:label('转换工作台','Conversion workspace'),Icon:ArrowRightLeft,count:files},{to:'/tools',label:label('工具箱','Tools'),Icon:ScanText},{to:'/history',label:label('任务记录','Task history'),Icon:History,count},{to:'/settings',label:t('nav.settings'),Icon:Settings}];
  return <aside className="app-sidebar">
    <div className="brand-block"><div className="flex h-10 w-10 shrink-0 items-center justify-center"><img src="/app-icon.png" alt="" className="h-full w-full object-contain" /></div><div className="brand-copy"><div className="text-xl font-bold tracking-tight">耄耋格式</div><span className="text-xs text-[rgb(var(--muted))]">{label('本地格式转换','Local file converter')}</span></div></div>
    <p className="nav-caption">{label('工作空间','Workspace')}</p>
    <nav aria-label={label('主导航','Main navigation')} className="flex flex-1 flex-col gap-1.5">{links.map(({to,label:caption,Icon,count})=><NavLink key={to} to={to} end={to==='/'} title={caption} aria-disabled={busy} onClick={e=>{if(busy)e.preventDefault();}} className={({isActive})=>clsx('nav-item',isActive?'nav-active text-brand-700 dark:text-brand-300':'text-[rgb(var(--muted))] hover:bg-[rgb(var(--border))]/40')}><Icon size={19} className="shrink-0"/><span className="nav-label">{caption}</span>{!!count&&<span className="nav-count">{count}</span>}</NavLink>)}</nav>
    <div className="sidebar-footer"><ShieldCheck size={17} className="shrink-0 text-brand-500"/><div className="nav-label"><p className="text-xs font-medium">{label('文件留在本机','Your files stay local')}</p><p className="mt-1 text-[10px] text-[rgb(var(--muted))]">耄耋格式 · {APP_VERSION}</p></div></div>
  </aside>;
}
