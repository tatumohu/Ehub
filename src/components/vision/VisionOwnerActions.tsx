import {useCallback,useState} from 'react';
import {MoreHorizontal,Pencil,Trash2} from 'lucide-react';
import {useAppContext} from '../../context/AppContext';
import CardDialog from '../business-cards/CardDialog';
import VisionComposer,{type VisionDraft} from './VisionComposer';
import {plainText,postImages,requestJson,type VisionPost} from './visionTools';
import {announceVisionChange} from './useVisionRevision';
export default function VisionOwnerActions({post}:{post:VisionPost}){
 const {user,language}=useAppContext(),ja=language==='ja';const [mode,setMode]=useState<'menu'|'edit'|'delete'|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState<VisionDraft>({text:'',images:[]});
 const close=useCallback(()=>{if(!busy){setMode(null);setError('')}},[busy]);
 if(!user||Number(user.id)!==Number(post.author_id))return null;
 const remove=async()=>{if(busy)return;setBusy(true);setError('');try{await requestJson(`/api/vision/${post.type}/${post.id}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:user.id})});setMode(null);announceVisionChange()}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 return <><button type="button" aria-label={ja?'Visionの操作':'Vision options'} data-testid="vision-owner-actions" onClick={()=>setMode('menu')} className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-blue-50 hover:text-blue-600"><MoreHorizontal className="h-5 w-5"/></button>
 {mode==='menu'&&<CardDialog title={ja?'自分のVision':'Your Vision'} closeLabel={ja?'操作を閉じる':'Close options'} onClose={close} testId="vision-owner-menu"><div className="space-y-2"><button type="button" onClick={()=>{setDraft({text:plainText(post.description),images:postImages(post)});setMode('edit')}} className="flex min-h-12 w-full items-center gap-3 rounded-xl p-3 text-left font-bold hover:bg-slate-50"><Pencil className="h-5 w-5"/>{ja?'Visionを編集':'Edit Vision'}</button><button type="button" onClick={()=>setMode('delete')} className="flex min-h-12 w-full items-center gap-3 rounded-xl p-3 text-left font-bold text-red-600 hover:bg-red-50"><Trash2 className="h-5 w-5"/>{ja?'Visionを削除':'Delete Vision'}</button></div></CardDialog>}
 {mode==='edit'&&<VisionComposer editing={post} draft={draft} onChange={setDraft} onClose={close} onPublished={announceVisionChange}/>}
 {mode==='delete'&&<CardDialog title={ja?'Visionを削除しますか？':'Delete this Vision?'} closeLabel={ja?'削除画面を閉じる':'Close deletion'} onClose={close} testId="vision-delete-dialog"><p className="text-sm leading-7 text-slate-700">{ja?'本文・画像・返信を削除します。この操作は取り消せません。引き継ぎ先のProjectと引用投稿は残り、元のVisionが削除されたことを表示します。':'The text, images and replies will be permanently deleted. Linked Projects and quote posts remain and show that the source Vision was deleted.'}</p>{error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" disabled={busy} onClick={close} className="min-h-11 rounded-full border border-slate-200 px-5 text-sm font-bold">{ja?'キャンセル':'Cancel'}</button><button type="button" data-testid="confirm-vision-delete" disabled={busy} onClick={remove} className="min-h-11 rounded-full bg-red-600 px-5 text-sm font-bold text-white disabled:opacity-40">{busy?(ja?'削除中…':'Deleting…'):(ja?'削除する':'Delete')}</button></div></CardDialog>}
 </>;
}
