import {useState} from 'react';
import CardArtwork from './CardArtwork';
import type { BusinessCard } from './cardTools';
const colors={blue:'border-t-blue-600',green:'border-t-emerald-600',slate:'border-t-slate-700'};
export default function CardView({card,interactive=true}:{card:BusinessCard;interactive?:boolean}) {
  const [side,setSide]=useState<'front'|'back'>('front');
  if(card.source==='created'&&card.design)return <div className="min-w-0 w-full"><CardArtwork design={card.design} card={card} side={side}/>{interactive&&card.design.back.elements.length>0&&<button type="button" onClick={()=>setSide(s=>s==='front'?'back':'front')} className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">{side==='front'?'裏面を表示':'表面を表示'}</button>}</div>;
  if(card.source==='photo'&&card.image)return <img data-testid="business-card-photo" src={card.image} alt={`${card.name}の名刺`} className="w-full min-h-[min(9rem,calc(100dvh-10rem))] max-h-[min(18rem,calc(100dvh-10rem))] rounded-xl bg-white object-contain"/>;
  return <article data-testid="business-card-view" className={`min-w-0 min-h-[170px] sm:min-h-[190px] w-full rounded-xl border border-slate-200 border-t-[6px] ${colors[card.style]||colors.blue} bg-white p-3 sm:p-5 shadow-sm flex flex-col justify-between gap-3`}>
    <div className="min-w-0"><p className="text-xs font-semibold text-slate-500 truncate" title={card.company}>{card.company||'E-hub'}</p><p className="text-xl sm:text-2xl font-bold text-slate-900 break-all line-clamp-2 mt-1">{card.name}</p><p className="text-xs text-slate-600 truncate mt-1" title={card.role}>{card.role}</p></div>
    <div className="min-w-0 text-[11px] leading-5 text-slate-600">{[card.email,card.phone,card.website].filter(Boolean).map((line,i)=><p key={i} className="truncate" title={line}>{line}</p>)}<p className="text-[9px] tracking-widest text-slate-400 mt-1">E-HUB BUSINESS CARD</p></div>
  </article>;
}
