import {useEffect,useState} from 'react';
import {useAppContext} from '../../context/AppContext';
// Keep open timelines and references in sync with edits in another tab.
export default function useVisionRevision(){
 const {socket}=useAppContext();const [revision,setRevision]=useState(0);
 useEffect(()=>{const refresh=()=>setRevision(v=>v+1);socket?.on('vision:changed',refresh);window.addEventListener('vision:changed',refresh);return()=>{socket?.off('vision:changed',refresh);window.removeEventListener('vision:changed',refresh)}},[socket]);
 return revision;
}
export const announceVisionChange=()=>window.dispatchEvent(new Event('vision:changed'));
