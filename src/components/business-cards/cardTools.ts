import type {CardDesign} from '../../../shared/businessCardDesign';
import jsQR from 'jsqr';
export type BusinessCard = {user_id:number;name:string;company:string;role:string;email:string;phone:string;website:string;style:'blue'|'green'|'slate';image:string;source:'empty'|'created'|'photo';design?:CardDesign|null;updated_at?:string;username?:string};
export const emptyCard=(id:number,name:string):BusinessCard=>({user_id:id,name,company:'',role:'',email:'',phone:'',website:'',style:'blue',image:'',source:'created'});
async function loadImage(file:File) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPEG・PNG・WebP画像を選択してください。');
  if(file.size>10*1024*1024)throw new Error('10MB以下の画像を選択してください。');
  const url=URL.createObjectURL(file);
  try{const image=new Image();image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url)}
}
export async function cardPhoto(file:File) {
  const image=await loadImage(file);const scale=Math.min(1,1400/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d')!;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',0.85);
}
export async function designImage(file:File) {
  const image=await loadImage(file);
  const scale=Math.min(1,1000/Math.max(image.width,image.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
  const ctx=canvas.getContext('2d')!;
  if(file.type==='image/jpeg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height)}
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL(file.type==='image/jpeg'?'image/jpeg':'image/png',0.85);
}
export async function readQrPhoto(file:File) {
  const image=await loadImage(file);const scale=Math.min(1,1800/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0,canvas.width,canvas.height);const code=jsQR(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);if(!code)throw new Error('QRコードが見つかりません。明るく、正面から写した画像でお試しください。');return code.data;
}
export function qrToken(value:string,origin:string) {
  let url:URL;try{url=new URL(value)}catch{throw new Error('E-hubの名刺QRコードを読み込んでください。')}
  const token=url.searchParams.get('card');
  if(url.origin!==origin||!/^\/profile\/\d+$/.test(url.pathname)||!token||!/^[a-f0-9-]{36}$/i.test(token))throw new Error('このE-hubの名刺QRコードではありません。');
  return token;
}
