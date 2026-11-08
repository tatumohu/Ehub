import {draftRequest,openDrafts} from '../drafts/draftTools';
import VisionQuoteCard from './VisionQuoteCard';
import {useCallback,useRef,useState} from 'react';
import {ImagePlus,X} from 'lucide-react';
import {useAppContext} from '../../context/AppContext';
import CardDialog from '../business-cards/CardDialog';
import {prepareImage,requestJson,type VisionPost} from './visionTools';
export type VisionDraft={text:string;images:string[]};
export default function VisionComposer({draft,onChange,onClose,onPublished,quote,editing,draftId,onSaved}:{draft:VisionDraft;onChange:(draft:VisionDraft)=>void;onClose:()=>void;onPublished:()=>void;quote?:{type:'project'|'idea';id:number};editing?:VisionPost;draftId?:string|null;onSaved?:(id:string)=>void}){
 const {user,language}=useAppContext(),ja=language==='ja';
 const [busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState('');
 const currentDraft=useRef(draft);currentDraft.current=draft;
 const close=useCallback(()=>{if(!busy&&!uploading)onClose()},[busy,uploading,onClose]);
 const add=async(files:FileList|null)=>{if(!files)return;setError('');if(files.length+draft.images.length>4){setError('画像は4枚まで追加できます。');return}setUploading(true);try{const added=await Promise.all([...files].map(prepareImage));onChange({...currentDraft.current,images:[...currentDraft.current.images,...added]})}catch(e:any){setError(e.message)}finally{setUploading(false)}};
 const publish=async(e:React.FormEvent)=>{e.preventDefault();if(!user||busy||uploading||(!draft.text.trim()&&!draft.images.length))return;setBusy(true);setError('');try{await requestJson(editing?`/api/vision/${editing.type}/${editing.id}`:'/api/vision',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({author_id:user.id,user_id:user.id,text:draft.text,images:draft.images,quote,...(!editing&&draftId?{draft_id:draftId}:{})})});window.dispatchEvent(new Event('drafts:changed'));onChange({text:'',images:[]});onPublished();onClose()}catch(e:any){setError(ja?`投稿できませんでした。${e.message} 入力内容は保持しています。`:'Unable to publish. Your draft has been kept.')}finally{setBusy(false)}};
 const saveDraft=async()=>{if(!user||busy||uploading)return;setBusy(true);setError('');try{const saved=await draftRequest(Number(user.id),draftId?'/'+draftId:'',draftId?'PUT':'POST',{kind:'vision',payload:{...draft,quote}});onSaved?.(saved.id);onClose();openDrafts('vision')}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 return <CardDialog title={editing?(ja?'Visionを編集':'Edit Vision'):quote?(ja?'引用して投稿':'Quote post'):(ja?'Visionを投稿':'Post a Vision')} onClose={close} closeLabel={ja?'投稿画面を閉じる':'Close composer'} testId="vision-compose-dialog">
  <form onSubmit={publish} data-testid="vision-composer" className="space-y-4">
   {!editing&&<div className="flex justify-end"><button type="button" data-testid="open-vision-drafts" disabled={busy||uploading} onClick={()=>{onClose();openDrafts('vision')}} className="min-h-10 rounded-full border border-slate-200 px-4 text-sm font-semibold text-blue-600 disabled:opacity-40">下書き一覧</button></div>}
   <div className="flex items-center gap-3">{user?.avatar&&<img src={user.avatar} alt="" className="h-10 w-10 rounded-full"/>}<p className="min-w-0 break-all font-bold">{user?.username}</p></div>
   <label htmlFor="vision-body" className="sr-only">{ja?'Visionの本文':'Vision text'}</label><textarea id="vision-body" disabled={busy} autoFocus value={draft.text} onChange={e=>onChange({...draft,text:e.target.value})} rows={7} placeholder={ja?'あなたの考えや、実現したいことを共有しましょう':'Share your thoughts and what you want to make happen'} className="block w-full min-w-0 resize-y rounded-xl border border-slate-200 bg-white p-3 text-base text-slate-900 outline-none focus:border-blue-400 [overflow-wrap:anywhere] max-h-[45dvh]"/>
   {(quote||editing?.quoted_item_id)&&<div><p className="text-xs font-semibold text-slate-500">{ja?'引用するVision':'Quoted Vision'}</p><VisionQuoteCard reference={quote||{id:editing!.quoted_item_id!,type:editing!.quoted_item_type!}}/></div>}
   {!!draft.images.length&&<div className="grid grid-cols-2 gap-2">{draft.images.map((src,i)=><div className="relative min-w-0" key={i}><img src={src} alt={`添付画像${i+1}`} className="h-32 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"/><button type="button" aria-label={`画像${i+1}を削除`} disabled={busy||uploading} onClick={()=>onChange({...draft,images:draft.images.filter((_,index)=>index!==i)})} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow"><X className="h-4 w-4"/></button></div>)}</div>}
   {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
   <div className="flex flex-wrap items-center justify-between gap-3"><label className={`flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold ${busy||uploading||draft.images.length>=4?'opacity-40':''}`}><ImagePlus className="h-5 w-5"/>{ja?'画像を追加':'Add images'}<input aria-label={ja?'投稿する画像':'Post images'} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy||uploading||draft.images.length>=4} onChange={e=>{add(e.target.files);e.target.value=''}}/></label><span className="text-xs text-slate-500">{draft.images.length}/4</span></div>
   <p className="text-xs text-slate-500">{ja?'文字数制限なし・画像は4枚まで':'No character limit · Up to 4 images'}</p>
   {!editing&&<button type="button" data-testid="save-vision-draft" onClick={saveDraft} disabled={busy||uploading||(!draft.text.trim()&&!draft.images.length)} className="min-h-11 w-full rounded-full border border-slate-300 px-5 py-2 font-bold text-slate-700 disabled:opacity-40">{busy?'保存中…':'下書きに保存'}</button>}
   <button type="submit" disabled={busy||uploading||(!draft.text.trim()&&!draft.images.length)} className="w-full rounded-full bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-40">{uploading?(ja?'画像を処理中…':'Processing images…'):busy?(ja?'投稿中…':'Posting…'):(editing?(ja?'変更を保存':'Save changes'):(ja?'投稿する':'Post'))}</button>
  </form>
 </CardDialog>;
}
