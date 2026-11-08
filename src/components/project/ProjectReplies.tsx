import {useCallback,useState} from 'react';
import {useAppContext} from '../../context/AppContext';
import VisionReplies from '../vision/VisionReplies';
import VisionReplyComposer,{type ReplyTarget} from '../vision/VisionReplyComposer';
import {replyCount,type VisionReply} from '../vision/replyTools';
import type {VisionPost} from '../vision/visionTools';
import {announceVisionChange} from '../vision/useVisionRevision';
export default function ProjectReplies({post,replies}:{post:VisionPost;replies:VisionReply[]}){
 const {user,language}=useAppContext(),ja=language==='ja';const [target,setTarget]=useState<ReplyTarget|null>(null),[drafts,setDrafts]=useState<Record<string,string>>({});const close=useCallback(()=>setTarget(null),[]);
 const open=(reply?:ReplyTarget)=>{if(!user){window.dispatchEvent(new CustomEvent('open-auth-modal'));return}setTarget(reply||{author_name:post.author_name,author_avatar:post.author_avatar})};
 return <section data-testid="project-replies" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900"><header className="flex flex-wrap items-center justify-between gap-3"><h2 data-testid="project-reply-count" className="text-lg font-bold">{ja?'返信':'Replies'} ({replyCount(replies)})</h2><button type="button" data-testid="project-write-reply" onClick={()=>open()} className="rounded-full bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">{ja?'返信する':'Reply'}</button></header>{replyCount(replies)?<VisionReplies post={post} replies={replies} onReply={open} manage={false}/>:<p className="py-6 text-center text-sm text-slate-500">{ja?'まだ返信がありません。':'No replies yet.'}</p>}{target&&<VisionReplyComposer post={post} target={target} value={drafts[target.id||'root']||''} onChange={value=>setDrafts(old=>({...old,[target.id||'root']:value}))} onClose={close} onSubmitted={announceVisionChange}/>}</section>;
}
