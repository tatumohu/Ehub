import {ChevronsLeft} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {useAppContext} from '../../context/AppContext';
export default function PreviousPageButton(){
 const navigate=useNavigate(),{language}=useAppContext();
 return <button type="button" data-testid="project-back" aria-label={language==='ja'?'前の画面に戻る':'Back to previous page'} onClick={()=>{if(Number(window.history.state?.idx)>0)navigate(-1);else navigate('/projects',{replace:true})}} className="mb-8 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"><ChevronsLeft aria-hidden="true" className="h-6 w-6"/></button>;
}
