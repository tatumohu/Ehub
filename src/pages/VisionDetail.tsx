import {replyCount} from '../components/vision/replyTools';
import VisionOwnerActions from '../components/vision/VisionOwnerActions';
import useVisionRevision from '../components/vision/useVisionRevision';
import VisionQuoteCard from '../components/vision/VisionQuoteCard';
import VisionReplyComposer,{type ReplyTarget} from '../components/vision/VisionReplyComposer';
import VisionReplies from '../components/vision/VisionReplies';
import {useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,Heart,Bookmark,MessageCircle,Share2,Quote} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
import SubscribeButton from '../components/SubscribeButton';
import CardDialog from '../components/business-cards/CardDialog';
import VisionImages from '../components/vision/VisionImages';
import {plainText,postImages,requestJson,visionHref,type VisionPost} from '../components/vision/visionTools';
export default function VisionDetail({initial:post}:{initial:VisionPost}){
 const {user,language,socket}=useAppContext(),ja=language==='ja';
 const [comments,setComments]=useState<any[]>(post.comments||[]),[text,setText]=useState(''),[reply,setReply]=useState<ReplyTarget|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[liked,setLiked]=useState(false),[saved,setSaved]=useState(false),[likes,setLikes]=useState(post.likes_count||0),[image,setImage]=useState('');
 const [reactionState,setReactionState]=useState<'loading'|'ready'|'error'>(()=>user?'loading':'ready'),[reactionRetry,setReactionRetry]=useState(0);
 const [replyDrafts,setReplyDrafts]=useState<Record<string,string>>({}),[threadTab,setThreadTab]=useState<'replies'|'quotes'>('replies'),[quotes,setQuotes]=useState<VisionPost[]>([]),[quoteError,setQuoteError]=useState(''),[quoteRetry,setQuoteRetry]=useState(0);
 const revision=useVisionRevision();
 const closeReply=useCallback(()=>setReply(null),[]);
 const openReply=(target?:ReplyTarget)=>{if(!user){signIn();return}setReply(target||{author_name:post.author_name,author_avatar:post.author_avatar})};
 const count=replyCount(comments);
 const currentReply=reply?.id?{...reply,...comments.find(c=>c.id===reply.id)}:reply;
 useEffect(()=>{setComments(post.comments||[])},[post.comments]);
 const receiveReply=(data:any)=>setComments(old=>old.some(c=>c.id===data.id)?old:[...old,data]);
 const closeImage=useCallback(()=>setImage(''),[]);
 const signIn=()=>window.dispatchEvent(new CustomEvent('open-auth-modal'));
 useEffect(()=>{
  if(!user){setLiked(false);setSaved(false);setReactionState('ready');return}
  const c=new AbortController();setReactionState('loading');
  const suffix=`?user_id=${user.id}&item_id=${post.id}&item_type=${post.type}`;
  Promise.all([requestJson('/api/likes/check'+suffix,{signal:c.signal}),requestJson('/api/archives/check'+suffix,{signal:c.signal})]).then(([l,a])=>{
   if(!c.signal.aborted){setLiked(l.liked);setSaved(a.archived);setReactionState('ready')}
  }).catch(()=>{if(!c.signal.aborted)setReactionState('error')});
  return()=>c.abort();
 },[post.id,post.type,user?.id,reactionRetry]);
 useEffect(()=>{if(!socket)return;const event=`${post.type}:${post.id}:comment`;const receive=(comment:any)=>setComments(old=>old.some(c=>c.id===comment.id)?old:[...old,comment]);socket.on(event,receive);return()=>{socket.off(event,receive)}},[socket,post.id,post.type]);
 useEffect(()=>{const c=new AbortController();setQuoteError('');requestJson(`/api/vision/${post.type}/${post.id}/quotes`,{signal:c.signal}).then(data=>{if(!c.signal.aborted)setQuotes(data)}).catch(()=>{if(!c.signal.aborted)setQuoteError(ja?'引用を読み込めませんでした。':'Unable to load quotes.')});return()=>c.abort()},[post.id,post.type,quoteRetry,ja,revision]);

 const act=async(kind:'likes'|'archives')=>{if(!user){signIn();return}if(busy||reactionState!=='ready')return;setBusy(kind);setError('');const selected=kind==='likes'?liked:saved;try{await requestJson('/api/'+kind,{method:selected?'DELETE':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:user.id,item_id:post.id,item_type:post.type})});if(kind==='likes'){setLiked(!selected);setLikes(n=>Math.max(0,n+(selected?-1:1)))}else setSaved(!selected)}catch{setError(ja?'操作を保存できませんでした。':'Unable to save this action.')}finally{setBusy('')}};
 const comment=async(e:React.FormEvent)=>{e.preventDefault();if(!user){signIn();return}if(!text.trim()||busy)return;setBusy('comment');setError('');try{const data=await requestJson(`/api/${post.type}s/${post.id}/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:user.id,content:text,parent_id:null})});setComments(old=>old.some(c=>c.id===data.id)?old:[...old,data]);setText('')}catch{setError(ja?'返信を保存できませんでした。入力内容は保持しています。':'Unable to save your reply. Your text has been kept.')}finally{setBusy('')}};
 const allowed=!Number(post.is_private)||Number(post.author_id)===Number(user?.id)||(()=>{try{return !!user&&JSON.parse(post.permitted_users||'[]').map(Number).includes(Number(user.id))}catch{return false}})();
 if(!allowed)return <p role="alert" className="mx-auto max-w-2xl p-6 text-slate-600">{ja?'この投稿を表示する権限がありません。':'You do not have access to this post.'}</p>;
 return <section data-testid="vision-detail" className="mx-auto min-w-0 max-w-2xl border-x border-slate-200 bg-white text-slate-900">
  <header className="flex items-center gap-3 border-b border-slate-200 p-4"><Link to="/vision" aria-label={ja?'Visionに戻る':'Back to Vision'} className="rounded-full p-2 text-slate-600 hover:bg-slate-100"><ArrowLeft className="h-5 w-5"/></Link><h1 className="text-lg font-bold">{ja?'投稿':'Post'}</h1><button type="button" aria-label={ja?'リンクをコピー':'Copy link'} onClick={async()=>{try{await navigator.clipboard.writeText(new URL(visionHref(post),location.origin).href);setNotice(ja?'リンクをコピーしました。':'Link copied.')}catch{setError(ja?'リンクをコピーできませんでした。':'Unable to copy link.')}}} className="ml-auto rounded-lg p-2 hover:bg-blue-50 hover:text-blue-600"><Share2 className="h-5 w-5"/></button></header>
  <article className="min-w-0 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><Link to={`/profile/${post.author_id}`} className="flex min-w-0 max-w-full flex-1 items-center gap-3">{post.author_avatar&&<img src={post.author_avatar} alt="" className="h-10 w-10 shrink-0 rounded-full"/>}<span className="break-all font-bold">{post.author_name}</span></Link>{Number(user?.id)!==Number(post.author_id)&&<SubscribeButton authorId={post.author_id} authorName={post.author_name}/>}<VisionOwnerActions post={post}/></div>
   <div data-testid="vision-detail-body" className="mt-5 whitespace-pre-wrap text-base leading-8 [overflow-wrap:anywhere]">{plainText(post.description)}</div>
   <VisionImages images={postImages(post)} onOpen={setImage}/>
   {post.quoted_item_id&&post.quoted_item_type&&<VisionQuoteCard reference={{id:post.quoted_item_id,type:post.quoted_item_type}}/>}
   {Number(user?.id)===Number(post.author_id)&&!Number(post.is_private)&&<Link data-testid="vision-to-project" to={`/create?type=recruitment&visionId=${post.id}&visionType=${post.type}`} className="mt-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700">{ja?'このVisionでProjectを作成':'Create Project from this Vision'}</Link>}
   <time className="mt-5 block text-xs text-slate-500" dateTime={post.created_at}>{new Date(post.created_at).toLocaleString(ja?'ja-JP':'en-US')}</time>{post.vision_edited_at&&<p className="mt-1 text-xs text-slate-500">{ja?'編集済み':'Edited'}</p>}
   <div aria-busy={reactionState==='loading'} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 py-3 text-slate-500"><button type="button" aria-label={ja?'返信を書く':'Write a reply'} onClick={()=>openReply()} className="flex items-center gap-2 rounded-lg p-2 hover:bg-blue-50 hover:text-blue-600"><MessageCircle className="h-5 w-5"/>{count}</button><Link to={`/vision?quoteId=${post.id}&quoteType=${post.type}`} aria-label={ja?'引用して投稿':'Quote post'} className="inline-flex items-center gap-1 rounded-lg p-2 hover:bg-blue-50 hover:text-blue-600"><Quote className="h-5 w-5"/><span className="text-xs">{quotes.length||''}</span></Link><button type="button" aria-label={ja?'いいね':'Like'} aria-pressed={liked} disabled={!!busy||reactionState!=='ready'} onClick={()=>act('likes')} className={`flex items-center gap-2 rounded-lg p-2 ${liked?'text-pink-600':'hover:bg-pink-50 hover:text-pink-600'}`}><Heart className="h-5 w-5" fill={liked?'currentColor':'none'}/>{likes}</button><button type="button" aria-label={ja?'保存':'Save'} aria-pressed={saved} disabled={!!busy||reactionState!=='ready'} onClick={()=>act('archives')} className={`rounded-lg p-2 ${saved?'text-blue-600':'hover:bg-blue-50 hover:text-blue-600'}`}><Bookmark className="h-5 w-5" fill={saved?'currentColor':'none'}/></button></div>
  </article>
  {reactionState==='loading'&&<p role="status" className="px-4 pb-2 text-xs text-slate-500">{ja?'いいね・保存の状態を読み込み中…':'Loading reactions…'}</p>}
  {reactionState==='error'&&<div role="alert" data-testid="vision-reaction-error" className="mx-4 mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{ja?'いいね・保存の状態を読み込めませんでした。':'Unable to load reactions.'}<button type="button" onClick={()=>{setReactionState('loading');setReactionRetry(v=>v+1)}} className="mt-2 block rounded-lg border border-red-200 px-3 py-2 font-semibold">{ja?'再読み込み':'Retry'}</button></div>}
  {error&&<p role="alert" className="mx-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="px-4 text-sm text-blue-600">{notice}</p>}
  <nav aria-label={ja?'返信と引用':'Replies and quotes'} role="tablist" className="grid grid-cols-2 border-b border-slate-200">
   {(['replies','quotes'] as const).map(tab=><button type="button" key={tab} role="tab" aria-selected={threadTab===tab} aria-controls={`vision-${tab}-panel`} id={`vision-${tab}-tab`} onClick={()=>setThreadTab(tab)} className={`min-h-12 border-b-2 p-3 text-sm font-bold ${threadTab===tab?'border-blue-600 text-blue-600':'border-transparent text-slate-500 hover:bg-slate-50'}`}>{tab==='replies'?(ja?'返信':'Replies'):(ja?'引用':'Quotes')} ({tab==='replies'?count:quotes.length})</button>)}
  </nav>
  {threadTab==='replies'?<section id="vision-replies-panel" role="tabpanel" aria-labelledby="vision-replies-tab" aria-label={ja?'返信':'Replies'} className="min-w-0 bg-white p-4">
   <form onSubmit={comment} className="space-y-3"><div className="flex min-w-0 gap-3">{user?.avatar&&<img src={user.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full"/>}<label className="min-w-0 flex-1"><span className="sr-only">{ja?'返信の本文':'Reply text'}</span><textarea id="vision-comment" disabled={busy==='comment'} rows={text?3:2} value={text} onChange={e=>setText(e.target.value)} placeholder={ja?'返信を投稿':'Post your reply'} className="w-full min-w-0 resize-y rounded-xl border border-slate-200 bg-white p-3 text-slate-900 outline-none focus:border-blue-400 [overflow-wrap:anywhere]"/></label></div><button type="submit" disabled={!text.trim()||!!busy} className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">{busy==='comment'?(ja?'送信中…':'Sending…'):(ja?'返信する':'Reply')}</button></form>
   {!count?<p className="py-8 text-center text-sm text-slate-500">{ja?'まだ返信がありません。':'No replies yet.'}</p>:<VisionReplies post={post} replies={comments} onReply={openReply}/>}
  </section>:<section id="vision-quotes-panel" role="tabpanel" aria-labelledby="vision-quotes-tab" className="min-w-0 bg-white p-4">{quoteError?<div role="alert" className="text-sm text-red-700">{quoteError}<button type="button" onClick={()=>setQuoteRetry(v=>v+1)} className="ml-2 underline">{ja?'再試行':'Retry'}</button></div>:quotes.length?quotes.map(q=><VisionQuoteCard key={`${q.type}:${q.id}`} post={q} label={ja?'引用投稿を表示':'Open quote post'}/>):<p className="py-8 text-center text-sm text-slate-500">{ja?'まだ引用がありません。':'No quotes yet.'}</p>}</section>}
  {reply&&user&&<VisionReplyComposer post={post} target={currentReply!} value={replyDrafts[reply.id||'root']||''} onChange={value=>setReplyDrafts(old=>({...old,[reply.id||'root']:value}))} onClose={closeReply} onSubmitted={receiveReply}/>}

  {image&&<CardDialog title={ja?'投稿の画像':'Post image'} onClose={closeImage} closeLabel={ja?'画像を閉じる':'Close image'} testId="vision-image-dialog"><img src={image} alt={ja?'投稿の拡大画像':'Expanded post image'} className="w-full max-h-[min(70dvh,calc(100dvh-10rem))] object-contain"/></CardDialog>}
 </section>;
}
