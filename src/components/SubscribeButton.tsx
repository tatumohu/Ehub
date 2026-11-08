import {useEffect,useState} from 'react';
import {UserPlus,UserCheck} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
export default function SubscribeButton({authorId,authorName}:{authorId:number;authorName:string}){
 const {user,language}=useAppContext(),ja=language==='ja';
 const [subscribed,setSubscribed]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();setError('');setSubscribed(false);setLoading(false);if(!user||!authorId)return;setLoading(true);fetch(`/api/users/${authorId}?current_user_id=${encodeURIComponent(user.id)}`,{signal:c.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(data=>{if(!c.signal.aborted)setSubscribed(!!data.isSubscribed)}).catch(()=>{if(!c.signal.aborted)setError(ja?'フォロー状態を読み込めませんでした。':'Unable to load following status.')}).finally(()=>{if(!c.signal.aborted)setLoading(false)});return()=>c.abort()},[user?.id,authorId,ja]);
 const toggle=async()=>{if(!user){window.dispatchEvent(new CustomEvent('open-auth-modal'));return}if(loading||Number(user.id)===Number(authorId))return;setLoading(true);setError('');try{const r=await fetch(`/api/users/${authorId}/${subscribed?'unsubscribe':'subscribe'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscriber_id:user.id})});if(!r.ok)throw new Error();setSubscribed(!subscribed)}catch{setError(ja?'フォローを変更できませんでした。':'Unable to update following.')}finally{setLoading(false)}};
 return <div className="max-w-full shrink-0"><button type="button" data-testid="follow-author" aria-pressed={subscribed} disabled={loading||Number(user?.id)===Number(authorId)} onClick={toggle} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${subscribed?'border border-blue-200 bg-blue-50 text-blue-700':'bg-blue-600 text-white hover:bg-blue-700'}`}>
  {subscribed?<UserCheck className="h-4 w-4"/>:<UserPlus className="h-4 w-4"/>}<span>{subscribed?(ja?'フォロー中':'Following'):(ja?'フォローする':'Follow')}</span>
 </button>{error&&<p role="alert" className="mt-1 max-w-56 text-xs text-red-700">{error}</p>}</div>;
}
