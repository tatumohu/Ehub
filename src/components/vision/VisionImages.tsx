export default function VisionImages({images,onOpen}:{images:string[];onOpen?:(src:string)=>void}){
 if(!images.length)return null;
 return <div data-testid="vision-images" className={`mt-3 grid min-w-0 gap-2 ${images.length>1?'grid-cols-2':'grid-cols-1'}`}>{images.map((src,i)=>onOpen?<button type="button" key={i} onClick={()=>onOpen(src)} aria-label={`画像${i+1}を拡大`} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={src} alt={`投稿の画像${i+1}`} className="w-full max-h-[min(24rem,calc(100dvh-10rem))] object-contain"/></button>:<img key={i} src={src} alt={`投稿の画像${i+1}`} className="w-full max-h-[min(20rem,calc(100dvh-10rem))] rounded-xl border border-slate-200 object-contain bg-slate-50"/>)}</div>;
}
