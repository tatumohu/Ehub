import CardDesigner from './CardDesigner';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {QrCode,ContactRound,ScanLine,Camera,Images} from 'lucide-react';
import QRCode from 'qrcode';
import CardView from './CardView';
import CardDialog from './CardDialog';
import CardCamera from './CardCamera';
import {emptyCard,cardPhoto,readQrPhoto,qrToken,type BusinessCard} from './cardTools';

type Props={userId:number;name:string;isOwn:boolean;actorId?:number;refreshKey?:boolean;onCollected:()=>void};
export default function BusinessCardPanel({userId,name,isOwn,actorId,refreshKey,onCollected}:Props){
 const navigate=useNavigate();
 const incomingToken=new URLSearchParams(location.search).get('card');
 const [card,setCard]=useState<BusinessCard|null>(null),[mode,setMode]=useState<'edit'|'qr'|'scan'|'collection'|null>(null),[tab,setTab]=useState<'created'|'photo'>('created');
 const [draft,setDraft]=useState<BusinessCard>(emptyCard(userId,name)),[camera,setCamera]=useState(false),[qr,setQr]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[collection,setCollection]=useState<BusinessCard[]>([]),[search,setSearch]=useState('');
 const reading=useRef(false),mounted=useRef(true),visibleMode=useRef(mode);visibleMode.current=mode;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 const close=useCallback(()=>{setMode(null);setCamera(false);setError('')},[]);
 const request=async(path:string,method='GET',body?:unknown)=>{const res=await fetch(path,{method,headers:{'Content-Type':'application/json',...(actorId?{'x-user-id':String(actorId)}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();if(!res.ok)throw new Error(data.error||'処理に失敗しました。');return data};
 useEffect(()=>{let active=true;setCard(null);fetch(`/api/users/${userId}/business-card`,{headers:actorId?{'x-user-id':String(actorId)}:{}}).then(r=>{if(!r.ok)throw new Error('名刺を読み込めませんでした。');return r.json()}).then(d=>{if(active)setCard(d.card)}).catch(e=>{if(active)setNotice(e.message)});return()=>{active=false}},[userId,actorId,refreshKey]);
 const open=(next:typeof mode)=>{setError('');setCamera(false);setMode(next)};
 const loadCollection=async()=>{const data=await request('/api/business-cards/collection');if(mounted.current)setCollection(data)};
 const openQr=async()=>{open('qr');setQr('');try{const identity=await request('/api/business-cards/identity','POST');const url=new URL(`/profile/${userId}`,location.origin);url.searchParams.set('card',identity.token);const image=await QRCode.toDataURL(url.href,{width:320,margin:4,errorCorrectionLevel:'M'});if(mounted.current&&visibleMode.current==='qr')setQr(image)}catch(e:any){setError(e.message)}};
 const collect=async(value:string)=>{if(reading.current)return false;reading.current=true;setError('');try{const token=qrToken(value,location.origin);const data=await request('/api/business-cards/collect','POST',{token});if(!mounted.current)return true;await loadCollection();onCollected();setNotice(`${data.card?.name||data.username}さんの名刺を取り込みました。${data.followed?'フォロー中に追加しました。':'すでにフォロー中です。'}`);setCamera(false);if(visibleMode.current)setMode('collection');return true}catch(e:any){if(mounted.current)setError(e.message);return false}finally{reading.current=false}};
 const upload=async(file:File|undefined,kind:'photo'|'qr')=>{if(!file)return;setError('');setBusy(true);if(kind==='qr')setCamera(false);try{if(kind==='qr')await collect(await readQrPhoto(file));else{const image=await cardPhoto(file);setDraft(d=>({...d,image,source:'photo'}));setCamera(false)}}catch(e:any){setError(e.message)}finally{if(mounted.current)setBusy(false)}};
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const result=await request(`/api/users/${userId}/business-card`,'PUT',{...draft,source:tab,image:tab==='photo'?draft.image:''});setCard(result.card);setNotice('名刺を登録しました。');close()}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 const edit=()=>{setDraft(card&&card.source!=='empty'?card:emptyCard(userId,name));setTab(card?.source==='photo'?'photo':'created');open('edit')};
 const hasCard=!!card&&card.source!=='empty';
 const button='rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50';
 if(!isOwn&&!hasCard&&!incomingToken)return null;
 return <section className="min-w-0 w-full" aria-label="名刺">
  {(hasCard||isOwn)&&<div data-testid={hasCard?'profile-business-card':'profile-card-actions'} className={hasCard?`relative rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4 ${isOwn?'pr-16 sm:pr-20':''}`:'flex justify-end items-center gap-2'}>
   {hasCard&&<div className="min-w-0 max-w-xl mx-auto"><CardView card={card!}/></div>}
   {isOwn&&<><button type="button" onClick={openQr} aria-label="自分のQRコードを表示" title="QRコード" className={`${hasCard?'absolute right-3 top-3':''} flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-blue-600 shadow-sm hover:bg-blue-50`}><QrCode className="h-5 w-5"/></button><button type="button" onClick={edit} aria-label="名刺を作成・登録" title="名刺を作成・登録" className={`${hasCard?'absolute right-3 bottom-3':'px-3 gap-2'} flex h-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 ${hasCard?'w-10':''}`}><ContactRound className="h-5 w-5"/>{!hasCard&&<span className="text-sm font-semibold">名刺を作成・登録</span>}</button></>}
  </div>}
  {!isOwn&&actorId&&incomingToken&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);open('collection');await collect(location.href);setBusy(false)}} className={`${button} mt-2`}>この名刺を取り込む・フォローする</button>}
  {notice&&<p role="status" className="mt-2 text-sm text-slate-600 break-words">{notice}</p>}
  {mode&&<CardDialog title={mode==='qr'?'自分のQRコード':mode==='scan'?'名刺のQRコードを読み取る':mode==='collection'?'取り込んだ名刺':'名刺を作成・登録'} onClose={close} wide={mode==='edit'&&tab==='created'}>
   {error&&<p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 break-words">{error}</p>}
   {mode==='qr'&&<div className="text-center space-y-4"><p className="text-sm text-slate-600">読み取った相手があなたをフォローし、登録済みの名刺をProfileで表示できるようになります。</p>{qr?<img src={qr} alt="自分の名刺QRコード" className="mx-auto w-full max-w-72 rounded-xl"/>:!error&&<p role="status">QRコードを作成しています…</p>}<button type="button" onClick={()=>{open('scan');setCamera(true)}} className={`${button} w-full flex justify-center items-center gap-2`}><ScanLine className="h-5 w-5"/>相手のQRコードを読み取る</button></div>}
   {mode==='scan'&&<div className="space-y-4">{camera?<CardCamera mode="qr" onCode={collect}/>:<button type="button" onClick={()=>setCamera(true)} className={`${button} w-full`}>カメラでQRコードを読み取る</button>}<label className={`${button} flex cursor-pointer items-center justify-center gap-2`}><Images className="h-5 w-5"/>QRコードの画像を選択<input aria-label="QRコードの画像" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={e=>{upload(e.target.files?.[0],'qr');e.target.value=''}}/></label><p className="text-xs text-slate-500">読み取り後、相手をフォロー中と名刺一覧に追加します。</p></div>}
   {mode==='collection'&&<div className="space-y-3"><input aria-label="名刺を検索" value={search} onChange={e=>setSearch(e.target.value)} placeholder="名前・会社で検索" className="w-full rounded-xl border border-slate-300 px-3 py-2.5"/>{collection.length===0?<p className="py-6 text-center text-sm text-slate-500">取り込んだ名刺はまだありません。</p>:<div className="grid grid-cols-1 gap-3">{collection.filter(c=>`${c.name} ${c.company}`.toLowerCase().includes(search.toLowerCase())).map(c=><button type="button" key={c.user_id} aria-label={`${c.name}のProfileを表示`} onClick={()=>{close();navigate(`/profile/${c.user_id}`)}} className="min-w-0 rounded-xl text-left focus-visible:outline-blue-600 hover:ring-2 hover:ring-blue-200">{c.source!=='empty'?<CardView card={c} interactive={false}/>:<p className="p-3 text-sm font-bold">{c.username||c.name}</p>}<p className="text-xs text-blue-600 p-2">Profileを表示 →</p></button>)}</div>}</div>}
   {mode==='edit'&&<form onSubmit={save} className="space-y-4">
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="名刺の登録方法">{(['created','photo'] as const).map(t=><button key={t} type="button" aria-pressed={tab===t} onClick={()=>{setTab(t);setCamera(false);setError('')}} className={`${button} ${tab===t?'bg-blue-50 border-blue-400 text-blue-700':''}`}>{t==='created'?'名刺を作成':'名刺を登録'}</button>)}</div>
    <p className="text-xs text-slate-500">登録した名刺は、あなたがフォローしている相手、またはあなたをフォローしている相手に表示されます。</p>
    {tab==='photo'&&<div className="space-y-3">{camera?<CardCamera mode="photo" onPhoto={image=>{setDraft(d=>({...d,image,source:'photo'}));setCamera(false)}}/>:<button type="button" onClick={()=>setCamera(true)} className={`${button} w-full flex items-center justify-center gap-2`}><Camera className="h-5 w-5"/>カメラで名刺を撮影</button>}<label className={`${button} flex cursor-pointer justify-center`}>名刺の画像を選択<input aria-label="名刺の画像" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} className="sr-only" onChange={e=>{upload(e.target.files?.[0],'photo');e.target.value=''}}/></label>{draft.image&&<img alt="登録する名刺のプレビュー" src={draft.image} className="max-h-56 w-full object-contain rounded-xl"/>}<p className="text-xs text-slate-500">写真を確認し、一覧に表示する氏名・会社などを入力してください。</p></div>}
    {tab==='created'&&<CardDesigner card={draft} onProcessing={setBusy} onChange={design=>setDraft(d=>({...d,design}))}/>}
    <div className="mx-auto w-full max-w-xl space-y-4">
    <p className="text-sm font-bold">名刺の基本情報</p>
    {([{key:'name',label:'氏名',max:120},{key:'company',label:'会社・所属',max:200},{key:'role',label:'役職',max:200},{key:'email',label:'メールアドレス',max:254,type:'email'},{key:'phone',label:'電話番号',max:80,type:'tel'},{key:'website',label:'Webサイト',max:500,type:'url'}] as const).map(f=><label key={f.key} className="block text-sm font-semibold">{f.label}{f.key==='name'?'（必須）':''}<input name={f.key} required={f.key==='name'} type={'type' in f?f.type:'text'} maxLength={f.max} value={draft[f.key]} onChange={e=>setDraft(d=>({...d,[f.key]:e.target.value}))} className="mt-1 w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 font-normal"/></label>)}
    <button type="submit" disabled={busy||(tab==='photo'&&!draft.image)} className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white disabled:opacity-50">{busy?'登録しています…':tab==='created'?'作成して登録':'この名刺を登録'}</button>
    </div>
   </form>}
  </CardDialog>}
 </section>;
}
