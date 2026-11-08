import {useEffect,useRef,useState} from 'react';
import jsQR from 'jsqr';
import {Camera,RefreshCw} from 'lucide-react';
export default function CardCamera({mode,onPhoto,onCode}:{mode:'photo'|'qr';onPhoto?:(image:string)=>void;onCode?:(value:string)=>Promise<boolean>}) {
  const video=useRef<HTMLVideoElement>(null),callback=useRef(onCode);callback.current=onCode;
  const [error,setError]=useState(''),[ready,setReady]=useState(false),[version,setVersion]=useState(0);
  useEffect(()=>{
    let cancelled=false,stream:MediaStream|undefined,frame=0,last=0,reading=false;
    setError('');setReady(false);
    const stop=()=>{cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop());if(video.current)video.current.srcObject=null;};
    const hidden=()=>{if(document.hidden){cancelled=true;stop();setReady(false);setError('カメラを停止しました。再開するには、もう一度起動してください。')}};
    const start=async()=>{try{
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('カメラはHTTPSまたはlocalhostで利用できます。画像ファイルからも登録・読み取りできます。');
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
      if(cancelled){stop();return}video.current!.srcObject=stream;await video.current!.play();if(cancelled){stop();return}setReady(true);
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true})!;
      const tick=async(now:number)=>{if(cancelled)return;const v=video.current;if(mode==='qr'&&!reading&&v&&v.videoWidth>0&&now-last>180){last=now;const scale=Math.min(1,800/v.videoWidth);canvas.width=Math.round(v.videoWidth*scale);canvas.height=Math.round(v.videoHeight*scale);ctx.drawImage(v,0,0,canvas.width,canvas.height);const result=jsQR(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,{inversionAttempts:'attemptBoth'});if(result){reading=true;const accepted=await callback.current?.(result.data);if(accepted){stop();return}reading=false;last=performance.now()+1500}}
        if(!cancelled)frame=requestAnimationFrame(tick);
      };frame=requestAnimationFrame(tick);
    }catch(e:any){stop();if(!cancelled)setError(e.name==='NotAllowedError'?'カメラが許可されていません。ブラウザの設定で許可するか、画像を選択してください。':e.name==='NotFoundError'?'カメラが見つかりません。画像ファイルを選択してください。':e.message?.includes('HTTPS')?e.message:'カメラを起動できません。他のアプリで使用中でないか確認するか、画像を選択してください。')}};
    document.addEventListener('visibilitychange',hidden);start();return()=>{cancelled=true;stop();document.removeEventListener('visibilitychange',hidden)};
  },[mode,version]);
  const capture=()=>{const v=video.current;if(!v||!v.videoWidth)return;const scale=Math.min(1,1400/v.videoWidth),canvas=document.createElement('canvas');canvas.width=Math.round(v.videoWidth*scale);canvas.height=Math.round(v.videoHeight*scale);canvas.getContext('2d')!.drawImage(v,0,0,canvas.width,canvas.height);onPhoto?.(canvas.toDataURL('image/jpeg',0.85))};
  return <div className="space-y-3" data-testid="card-camera">
    <div className="relative overflow-hidden rounded-xl bg-slate-100"><video ref={video} autoPlay muted playsInline aria-label="名刺用カメラ" className={`w-full max-h-[45dvh] object-contain ${error?'hidden':''}`}/>{!error&&<p className="px-3 py-2 text-xs text-slate-600">{mode==='qr'?'QRコードをカメラに向けてください。':'名刺全体が入るように撮影してください。'}</p>}</div>
    {error?<div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}<button type="button" onClick={()=>setVersion(v=>v+1)} className="mt-3 flex items-center gap-2 font-bold"><RefreshCw className="h-4 w-4"/>カメラを再起動</button></div>:!ready?<p role="status" className="text-sm text-slate-500">カメラを起動しています…</p>:mode==='photo'&&<button type="button" onClick={capture} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"><Camera className="h-5 w-5"/>名刺を撮影する</button>}
  </div>;
}
