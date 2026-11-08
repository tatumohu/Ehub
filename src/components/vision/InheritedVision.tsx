import useVisionRevision from './useVisionRevision';
import {useEffect,useState} from 'react';
import {useAppContext} from '../../context/AppContext';
import {requestJson,type VisionPost} from './visionTools';
import VisionQuoteCard from './VisionQuoteCard';
export default function InheritedVision({projectId}:{projectId:string}){
 const revision=useVisionRevision();
 const {user,language}=useAppContext();const [post,setPost]=useState<VisionPost|null>(null),[unavailable,setUnavailable]=useState(false),[deleted,setDeleted]=useState(false);
 useEffect(()=>{const c=new AbortController();setPost(null);setUnavailable(false);setDeleted(false);requestJson(`/api/projects/${projectId}/inherited-vision${user?`?user_id=${user.id}`:''}`,{signal:c.signal}).then(data=>{if(!c.signal.aborted){setPost(data.vision);setUnavailable(!!data.unavailable);setDeleted(!!data.deleted)}}).catch(()=>{if(!c.signal.aborted)setUnavailable(true)});return()=>c.abort()},[projectId,user?.id,revision]);
 if(!post&&!unavailable)return null;
 return <section data-testid="project-inherited-vision" className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-lg font-bold text-slate-900">{language==='ja'?'引き継いだVision':'Source Vision'}</h2>{post?<VisionQuoteCard post={post} label={language==='ja'?'引き継いだVisionを開く':'Open source Vision'}/>:<p className="mt-3 text-sm text-slate-500">{deleted?(language==='ja'?'引き継ぎ元のVisionは削除されました。':'The source Vision was deleted.'):(language==='ja'?'引き継ぎ元のVisionは現在表示できません。':'The source Vision is currently unavailable.')}</p>}</section>;
}
