import useVisionRevision from './useVisionRevision';
import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAppContext} from '../../context/AppContext';
import {plainText,postImages,requestJson,visionHref,type VisionPost} from './visionTools';
import VisionImages from './VisionImages';
export function VisionCardContent({post}:{post:VisionPost}){
 const {language}=useAppContext();
 return <div className="min-w-0 p-3"><div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">{post.author_avatar&&<img src={post.author_avatar} alt="" className="h-6 w-6 shrink-0 rounded-full"/>}<span className="min-w-0 break-all font-bold text-slate-900">{post.author_name}</span><time className="text-slate-500">{new Date(post.created_at).toLocaleDateString()}</time>{(post.vision_edited_at||post.project_edited_at)&&<span className="text-slate-500">{language==='ja'?'編集済み':'Edited'}</span>}</div>{Number(post.is_recruitment)===1&&post.title&&<h3 className="mt-2 break-words text-sm font-bold text-slate-900">{post.title}</h3>}<p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">{plainText(post.description)}</p><VisionImages images={postImages(post)}/></div>;
}
export default function VisionQuoteCard({post,reference,label}:{post?:VisionPost;reference?:{id:number;type:'project'|'idea'};label?:string}){
 const revision=useVisionRevision();
 const {user,language}=useAppContext();const [loaded,setLoaded]=useState<VisionPost|null>(post||null),[failed,setFailed]=useState(false),[deleted,setDeleted]=useState(false),[deletedProject,setDeletedProject]=useState(false);
 useEffect(()=>{if(post){setLoaded(post);setFailed(false);setDeleted(false);return}if(!reference)return;const c=new AbortController();setLoaded(null);setFailed(false);setDeleted(false);requestJson(`/api/vision/${reference.type}/${reference.id}/reference${user?`?user_id=${user.id}`:''}`,{signal:c.signal}).then(data=>{if(!c.signal.aborted){setLoaded(data.vision);setDeleted(!!data.deleted);setDeletedProject(!!data.deletedProject);setFailed(!data.vision)}}).catch(()=>{if(!c.signal.aborted)setFailed(true)});return()=>c.abort()},[post,reference?.id,reference?.type,user?.id,revision]);
 if(!loaded)return <div data-testid="vision-quote-card" data-deleted={deleted||undefined} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">{deleted?(deletedProject?(language==='ja'?'元のProjectは削除されました。':'The source Project was deleted.'):(language==='ja'?'元のVisionは削除されました。':'The source Vision was deleted.')):failed?(language==='ja'?'元の投稿は現在表示できません。':'Original post unavailable.'):(language==='ja'?'引用元を読み込み中…':'Loading original post…')}</div>;

 const project=Number(loaded.is_recruitment)===1;
 return <Link data-testid="vision-quote-card" aria-label={label||(language==='ja'?'引用元のVisionを表示':'Open quoted Vision')} to={project?`/${loaded.type}/${loaded.id}`:visionHref(loaded)} state={{section:project?'project':undefined}} className="mt-3 block min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white text-left hover:bg-slate-50"><VisionCardContent post={loaded}/></Link>;
}
