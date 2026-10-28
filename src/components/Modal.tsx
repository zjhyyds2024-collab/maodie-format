import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useLabel } from '../i18n/enhanced';
export default function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);const id=useId();const label=useLabel();
  useEffect(()=>{const node=ref.current;node?.showModal();return()=>node?.close();},[]);
  return <dialog ref={ref} aria-labelledby={id} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}} className="preview-dialog max-w-xl">
    <header className="flex items-center justify-between gap-4 border-b border-[rgb(var(--border))] p-5"><h2 className="font-semibold" id={id}>{title}</h2><button className="tool-button" onClick={onClose} aria-label={label('关闭','Close')}><X size={17}/></button></header>
    <div className="p-5">{children}</div>
  </dialog>;
}
