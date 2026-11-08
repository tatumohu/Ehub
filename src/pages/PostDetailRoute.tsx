import useVisionRevision from '../components/vision/useVisionRevision';
import {useEffect,useState} from 'react';
import {Navigate,useParams} from 'react-router-dom';
import {useAppContext} from '../context/AppContext';
import {requestJson,type VisionPost} from '../components/vision/visionTools';
import VisionDetail from './VisionDetail';
import ProjectDetail from './ProjectDetail';
import IdeaDetail from './IdeaDetail';
export default function PostDetailRoute({kind}:{kind?:'project'|'idea'}){
 const revision=useVisionRevision();
 const params=useParams(),type=kind||params.type,id=params.id;
 const {user,isAuthLoaded,language}=useAppContext();const [post,setPost]=useState<VisionPost|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(!isAuthLoaded)return;const c=new AbortController();setError('');if(!['project','idea'].includes(type||'')){setError('投稿が見つかりません。');return}requestJson(`/api/${type}s/${id}${user?`?user_id=${user.id}`:''}`,{signal:c.signal}).then(d=>{if(!c.signal.aborted)setPost({...d,type})}).catch(e=>{if(!c.signal.aborted)setError(e.status===404?(language==='ja'?'この投稿は削除されたか、存在しません。':'This post was deleted or does not exist.'):(language==='ja'?'投稿を読み込めませんでした。':'Unable to load this post.'))});return()=>c.abort()},[type,id,user?.id,isAuthLoaded,language,revision]);
 if(error)return <p role="alert" className="mx-auto max-w-2xl rounded-xl bg-red-50 p-6 text-red-700">{error}</p>;
 // A route change renders before the effect clears the previous post. Never
 // classify the new route using metadata from the post we just left.
 if(!post||String(post.id)!==id||post.type!==type)return <p role="status" className="p-8 text-center text-slate-500">Loading…</p>;
 const project=Number(post.is_recruitment)===1,store=Number(post.is_buyout)===1||post.status==='completed';
 if((project||store)&&!kind)return <Navigate replace to={store&&type==='project'?`/completed/${id}`:`/${type}/${id}`} state={{section:store?'store':'project'}}/>;
 if(project||store)return type==='project'?<ProjectDetail/>:<IdeaDetail/>;
 return <VisionDetail key={`${type}:${id}`} initial={post}/>;
}
