import { open } from '@tauri-apps/plugin-dialog';
import { KeyRound, FolderOpen, X } from 'lucide-react';
import { useAppStore } from '../store';
import { useLabel } from '../i18n/enhanced';
import { errorMessage } from '../converters/tasks';

export default function MusicOptions() {
  const label=useLabel();const access=useAppStore(s=>s.musicAccess);const busy=useAppStore(s=>s.batchRunning);
  const update=useAppStore(s=>s.setMusicAccess);
  const choose=async()=>{try {const path=await open({multiple:false,title:label('选择 QQ 音乐密钥库','Select QQ Music key database')});if(typeof path==='string')update({...access,keyDatabase:path});}catch(error){useAppStore.getState().addToast(errorMessage(error),'error');}};
  return <details className="inspector-section music-options"><summary><KeyRound size={14}/>{label('音乐解码','Music decoding')}</summary>
    <p className="inspector-note">{label('支持网易云、QQ 音乐、酷狗旧版和酷我旧版。无内嵌密钥的 QQ 文件需提供对应密钥。KGG v5 暂不支持。','Supports NetEase, QQ Music, older Kugou and Kuwo formats. QQ files without embedded keys need a matching key. KGG v5 is unsupported.')}</p>
    <label className="mt-4 block text-xs">{label('QQ 音乐 EKey（可选）','QQ Music EKey (optional)')}<input className="select-field mt-2 w-full" aria-label={label('QQ 音乐 EKey','QQ Music EKey')} type="password" autoComplete="off" spellCheck={false} maxLength={4096} value={access.ekey??''} disabled={busy} onChange={e=>update({...access,ekey:e.target.value||undefined})}/></label>
    <button className="tool-button mt-3 w-full" disabled={busy} onClick={()=>void choose()}><FolderOpen size={14}/>{label('选择本地密钥库','Select key database')}</button>
    {access.keyDatabase && <p className="mt-2 break-all text-xs text-[rgb(var(--muted))]">{access.keyDatabase}</p>}
    {(access.ekey||access.keyDatabase)&&<button className="tool-button mt-2" disabled={busy} onClick={()=>update({})}><X size={13}/>{label('清除本次密钥','Clear session keys')}</button>}
    <p className="inspector-note">{label('密钥仅保留在本次会话，不写入设置或任务记录；密钥库只读打开。','Keys stay in this session and are excluded from settings and history. Databases are read-only.')}</p>
  </details>;
}
