import { Link } from 'react-router-dom';
import { History, ChevronRight, FileText } from 'lucide-react';
import { useLabel } from '../i18n/enhanced';
import { useHistoryStore } from '../store/history';
import { operations } from '../tools/operations';

export default function RecentTasks() {
  const label = useLabel();
  const entries = useHistoryStore(s => s.entries);
  return <details className="recent-tasks">
    <summary><History size={15}/><span>{label('最近任务', 'Recent tasks')}</span><span className="text-[rgb(var(--muted))]">{entries.length}</span><ChevronRight size={14} className="disclosure-arrow ml-auto"/></summary>
    <div className="px-4 pb-3">
      {entries.length ? <>
        {entries.slice(0, 4).map(entry => {
          const operation = operations.find(item => item.id === entry.target);
          return <Link key={entry.id} to="/history" className="recent-task-row">
            <FileText size={17} className="shrink-0 text-[rgb(var(--muted))]"/>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{entry.name}</span><span className="mt-1 block text-xs text-[rgb(var(--muted))]">{operation ? label(operation.zh, operation.en) : (entry.target==="restore-audio"?label("原始音频", "Original audio"):entry.target.toUpperCase())}</span></span>
            <span className={`text-xs ${entry.status === 'done' ? 'text-brand-600 dark:text-brand-400' : entry.status === 'error' ? 'text-red-500' : 'text-[rgb(var(--muted))]'}`}>{entry.status === 'done' ? label('已完成', 'Completed') : entry.status === 'error' ? label('失败', 'Failed') : label('已取消', 'Cancelled')}</span>
          </Link>;
        })}
        <Link to="/history" className="mt-3 inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400">{label('查看全部记录', 'View all tasks')}<ChevronRight size={13}/></Link>
      </> : <p className="py-3 text-sm text-[rgb(var(--muted))]">{label('完成转换后，可在这里找到最近的任务记录。', 'Your recent tasks will appear here after converting.')}</p>}
    </div>
  </details>;
}
