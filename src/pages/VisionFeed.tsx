import {draftRequest} from '../components/drafts/draftTools';
import VisionOwnerActions from '../components/vision/VisionOwnerActions';
import useVisionRevision from '../components/vision/useVisionRevision';
import VisionQuoteCard from '../components/vision/VisionQuoteCard';
import VisionReplyComposer,{type ReplyTarget} from '../components/vision/VisionReplyComposer';
import {useCallback,useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {Heart,MessageCircle,Bookmark,RefreshCw,Lock,Quote,Plus} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
import VisionComposer,{type VisionDraft} from '../components/vision/VisionComposer';
import VisionImages from '../components/vision/VisionImages';
import {plainText,postKey,postImages,requestJson,visionHref,type VisionPost} from '../components/vision/visionTools';
export default function VisionFeed(){const {user,isAuthLoaded}=useAppContext();return isAuthLoaded?<VisionTimeline key={user?.id||'guest'}/>:<p role="status" className="p-8 text-center text-slate-500">Loading…</p>}
function VisionTimeline(){
 const {user,language}=useAppContext(),ja=language==='ja';
 const revision=useVisionRevision();
 const [params,setParams]=useSearchParams();
 const [posts,setPosts]=useState<VisionPost[]>([]),[liked,setLiked]=useState<Set<string>>(new Set()),[saved,setSaved]=useState<Set<string>>(new Set()),[expanded,setExpanded]=useState<Set<string>>(new Set()),[pending,setPending]=useState<Set<string>>(new Set());
 const draftKey=`ehub_vision_draft_${user?.id||'guest'}`;
 const [draft,setDraft]=useState<VisionDraft>(()=>{try{return {text:localStorage.getItem(draftKey)||'',images:[]}}catch{return {text:'',images:[]}}});
 const [replying,setReplying]=useState<VisionPost|null>(null),[replyDrafts,setReplyDrafts]=useState<Record<string,string>>({});
 const closeReply=useCallback(()=>setReplying(null),[]);
 const [composing,setComposing]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[version,setVersion]=useState(0);
 const quoteType=params.get('quoteType'),quoteId=Number(params.get('quoteId'));
 const savedDraftId=params.get('draft');
 const [activeDraftId,setActiveDraftId]=useState<string|null>(null),[draftQuote,setDraftQuote]=useState<{type:'project'|'idea';id:number}|undefined>();
 const paramQuote=['project','idea'].includes(quoteType||'')&&Number.isSafeInteger(quoteId)&&quoteId>0?{type:quoteType as 'project'|'idea',id:quoteId}:undefined;
 const quote=paramQuote||draftQuote;
 const signIn=()=>window.dispatchEvent(new CustomEvent('open-auth-modal'));
 const close=useCallback(()=>{setComposing(false);setParams({}, {replace:true})},[setParams]);
 useEffect(()=>{try{localStorage.setItem(draftKey,draft.text)}catch{}},[draftKey,draft.text]);
 useEffect(()=>{if(paramQuote&&user&&!savedDraftId){setDraftQuote(paramQuote);setComposing(true)}},[quoteType,quoteId,user?.id,savedDraftId]);
 useEffect(()=>{if(!savedDraftId||!user)return;let active=true;setComposing(false);draftRequest(Number(user.id),'/'+savedDraftId).then(d=>{if(!active)return;if(d.kind!=='vision')throw Error('Visionの下書きではありません。');setDraft({text:d.payload.text||'',images:d.payload.images||[]});setDraftQuote(d.payload.quote);setActiveDraftId(d.id);setComposing(true)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[savedDraftId,user?.id]);
 useEffect(()=>{
  const controller=new AbortController();if(!posts.length)setLoading(true);setError('');const suffix=user?`?user_id=${user.id}`:'';
  Promise.all([requestJson('/api/projects'+suffix,{signal:controller.signal}),requestJson('/api/ideas'+suffix,{signal:controller.signal}),requestJson('/api/vision/quote-counts',{signal:controller.signal}),user?requestJson(`/api/users/${user.id}/likes`,{signal:controller.signal}):[],user?requestJson(`/api/users/${user.id}/archives`,{signal:controller.signal}):[]]).then(([projects,ideas,quoteCounts,likes,archives])=>{
   if(controller.signal.aborted)return;
   const visible=(p:VisionPost)=>{if(Number(p.is_recruitment)===1||Number(p.is_buyout)===1||p.status==='completed')return false;if(!Number(p.is_private)||Number(p.author_id)===Number(user?.id))return true;try{return !!user&&JSON.parse(p.permitted_users||'[]').map(Number).includes(Number(user.id))}catch{return false}};
   const data=[...projects.map((p:VisionPost)=>({...p,type:'project' as const})),...ideas.map((p:VisionPost)=>({...p,type:'idea' as const}))].filter(visible);data.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id);setPosts(data.map(p=>({...p,quotes_count:quoteCounts[postKey(p)]||0})));setLiked(new Set(likes.map(postKey)));setSaved(new Set(archives.map(postKey)));
  }).catch(()=>{if(!controller.signal.aborted)setError(ja?'投稿を読み込めませんでした。もう一度お試しください。':'Unable to load posts. Please try again.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort();
 },[user?.id,version,ja,revision]);
 const reactTo=async(post:VisionPost,kind:'likes'|'archives')=>{
  if(!user){signIn();return}const key=postKey(post),operation=kind+key;if(pending.has(operation))return;
  const values=kind==='likes'?liked:saved,selected=values.has(key);setPending(p=>new Set(p).add(operation));
  try{await requestJson('/api/'+kind,{method:selected?'DELETE':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:user.id,item_id:post.id,item_type:post.type})});const setter=kind==='likes'?setLiked:setSaved;setter(current=>{const next=new Set(current);selected?next.delete(key):next.add(key);return next});const field=kind==='likes'?'likes_count':'archives_count';setPosts(current=>current.map(p=>postKey(p)===key?{...p,[field]:Math.max(0,Number(p[field]||0)+(selected?-1:1))}:p))}catch{setError(ja?'操作を保存できませんでした。':'Unable to save this action.')}finally{setPending(p=>{const next=new Set(p);next.delete(operation);return next})}
 };
 return <section data-section="vision" className="mx-auto min-h-full min-w-0 max-w-2xl border-x border-slate-200 bg-white pb-24 text-slate-900">
  <header className="flex items-center justify-between border-b border-slate-200 px-4 py-4"><h1 className="text-xl font-bold">Vision</h1><button aria-label={ja?'投稿を更新':'Refresh posts'} onClick={()=>setVersion(v=>v+1)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><RefreshCw className="h-5 w-5"/></button></header>
  {error&&<div role="alert" className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={()=>setVersion(v=>v+1)} className="ml-2 underline">{ja?'再試行':'Retry'}</button></div>}
  {loading?<p role="status" className="p-8 text-center text-slate-500">{ja?'読み込み中…':'Loading…'}</p>:!posts.length?<p className="p-8 text-center text-slate-500">{ja?'まだ投稿がありません。右下の＋から最初のVisionを共有しましょう。':'No posts yet. Use + to share your first Vision.'}</p>:posts.map(post=>{
   const key=postKey(post),text=plainText(post.description),collapsible=text.length>280||text.split('\n').length>6,href=visionHref(post);
   return <article key={key} data-testid="vision-post" data-post-id={key} className="border-b border-slate-200 px-4 py-5 hover:bg-slate-50/50"><div className="flex min-w-0 items-start gap-3">
    <Link to={`/profile/${post.author_id}`} className="shrink-0">{post.author_avatar?<img src={post.author_avatar} alt="" className="h-10 w-10 rounded-full"/>:<span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">{post.author_name?.slice(0,1)}</span>}</Link>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"><Link to={`/profile/${post.author_id}`} className="break-all font-bold">{post.author_name}</Link><time className="text-xs text-slate-500" dateTime={post.created_at}>{new Date(post.created_at).toLocaleString(ja?'ja-JP':'en-US')}</time>{post.vision_edited_at&&<span className="text-xs text-slate-500">{ja?'編集済み':'Edited'}</span>}{Number(post.is_private)===1&&<Lock aria-label="Private" className="h-3 w-3"/>}<VisionOwnerActions post={post}/></div>
     <Link to={href} aria-label={ja?'投稿の詳細を開く':'Open post details'} className={`mt-2 whitespace-pre-wrap text-[15px] leading-7 [overflow-wrap:anywhere] ${!collapsible||expanded.has(key)?'block':'line-clamp-6'}`}>{text}</Link>
     {collapsible&&<button onClick={()=>setExpanded(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next})} className="mt-2 text-sm text-blue-600">{expanded.has(key)?(ja?'折りたたむ':'Show less'):(ja?'続きを読む':'Read more')}</button>}
     <Link to={href} aria-label={ja?'投稿の画像を開く':'Open post images'}><VisionImages images={postImages(post)}/></Link>
     {post.quoted_item_id&&post.quoted_item_type&&<VisionQuoteCard reference={{id:post.quoted_item_id,type:post.quoted_item_type}}/>}
     <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><button type="button" onClick={()=>user?setReplying(post):signIn()} aria-label={ja?'返信を開く':'Open replies'} className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2 hover:bg-blue-50 hover:text-blue-600"><MessageCircle className="h-4 w-4"/>{post.comments_count||0}</button><Link to={`/vision?quoteId=${post.id}&quoteType=${post.type}`} aria-label={ja?'引用して投稿':'Quote post'} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg px-2 hover:bg-blue-50 hover:text-blue-600"><Quote className="h-4 w-4"/><span>{post.quotes_count||0}</span></Link><button aria-label={ja?'いいね':'Like'} aria-pressed={liked.has(key)} disabled={pending.has('likes'+key)} onClick={()=>reactTo(post,'likes')} className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2 ${liked.has(key)?'text-pink-600':'hover:text-pink-600'}`}><Heart className="h-4 w-4" fill={liked.has(key)?'currentColor':'none'}/>{post.likes_count||0}</button><button aria-label={ja?'保存':'Save'} aria-pressed={saved.has(key)} disabled={pending.has('archives'+key)} onClick={()=>reactTo(post,'archives')} className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg px-2 ${saved.has(key)?'text-blue-600':'hover:bg-blue-50 hover:text-blue-600'}`}><Bookmark className="h-4 w-4" fill={saved.has(key)?'currentColor':'none'}/></button></div>
    </div></div></article>;
  })}
  <button type="button" data-testid="vision-create-button" aria-label={ja?'Visionを投稿':'Create Vision'} onClick={()=>user?setComposing(true):signIn()} className="fixed right-5 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[110] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 md:bottom-[calc(6rem+env(safe-area-inset-bottom))]"><Plus className="h-7 w-7"/></button>
  {replying&&user&&<VisionReplyComposer post={replying} target={{author_name:replying.author_name,author_avatar:replying.author_avatar}} value={replyDrafts[postKey(replying)]||''} onChange={text=>setReplyDrafts(old=>({...old,[postKey(replying)]:text}))} onClose={closeReply} onSubmitted={()=>setVersion(v=>v+1)}/>}
  {composing&&user&&<VisionComposer draft={draft} onChange={setDraft} onClose={close} onPublished={()=>{setActiveDraftId(null);setDraftQuote(undefined);setExpanded(new Set());setVersion(v=>v+1)}} draftId={activeDraftId} onSaved={()=>{setActiveDraftId(null);setDraft({text:'',images:[]});setDraftQuote(undefined)}} quote={quote}/>}
 </section>;
}
