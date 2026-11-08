import { useEffect, useId, useRef } from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
export default function CardDialog({title,onClose,children,wide=false,sidebar=false,closeLabel='名刺画面を閉じる',testId='business-card-dialog'}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean;sidebar?:boolean;closeLabel?:string;testId?:string}) {
  const ref=useRef<HTMLDivElement>(null),heading=useId();
  useEffect(()=>{const previous=document.activeElement as HTMLElement;const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';ref.current?.focus();const listener=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose()}if(event.key==='Tab'){const nodes=[...ref.current!.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select,textarea,a[href]')].filter(el=>el.getClientRects().length>0);const first=nodes[0],last=nodes.at(-1);if(!first){event.preventDefault();return}if(event.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){event.preventDefault();last?.focus()}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){event.preventDefault();first.focus()}}};document.addEventListener('keydown',listener);return()=>{document.removeEventListener('keydown',listener);document.body.style.overflow=oldOverflow;if(previous?.isConnected)previous.focus()}},[onClose]);
  return createPortal(<div className={`fixed inset-0 z-[400] flex bg-slate-950/60 ${sidebar?'items-stretch justify-start':'items-center justify-center p-3 sm:p-6'}`} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={heading} data-testid={testId} className={`flex w-full ${sidebar?'max-w-sm h-dvh':wide?'max-w-[1440px]':'max-w-xl'} ${sidebar?'max-h-dvh rounded-none':'max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] rounded-2xl'} flex-col overflow-hidden bg-white text-slate-900 shadow-2xl outline-none`}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><h2 id={heading} className="min-w-0 text-lg font-bold">{title}</h2><button type="button" onClick={onClose} aria-label={closeLabel} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100"><X className="h-5 w-5"/></button></header>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
    </div>
  </div>,document.body);
}
