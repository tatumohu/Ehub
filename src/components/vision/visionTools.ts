export type VisionPost={id:number;type:'project'|'idea';title?:string;description:string;image?:string;images?:string|string[];author_id:number;author_name:string;author_avatar:string;created_at:string;vision_edited_at?:string;project_edited_at?:string;is_private?:number;permitted_users?:string;is_recruitment?:number;is_buyout?:number;status?:string;likes_count?:number;archives_count?:number;comments_count?:number;quotes_count?:number;quoted_item_id?:number;quoted_item_type?:'project'|'idea';comments?:any[]};
export const postKey=(p:{type:string;id:number})=>`${p.type}:${p.id}`;
export const visionHref=(p:{type:string;id:number})=>`/vision/${p.type}/${p.id}`;
export function plainText(html:string){return new DOMParser().parseFromString((html||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(p|div|li|h[1-6])>/gi,'\n'),'text/html').body.textContent?.trim()||''}
export async function requestJson(url:string,options?:RequestInit){const res=await fetch(url,options);const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error||'処理に失敗しました。'),{status:res.status});return data}
export function postImages(post:Pick<VisionPost,'images'|'image'>):string[]{let values:any=post.images;try{if(typeof values==='string')values=JSON.parse(values)}catch{values=[]}if(!Array.isArray(values)||!values.length)values=post.image?[post.image]:[];return values.filter((src:any)=>typeof src==='string'&&(/^(https?:\/\/)/i.test(src)||/^data:image\/(jpeg|png|webp);base64,/.test(src))).slice(0,4)}
export async function prepareImage(file:File){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPEG・PNG・WebP画像を選択してください。');
 if(file.size>10*1024*1024)throw new Error('10MB以下の画像を選択してください。');
 const url=URL.createObjectURL(file);
 try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,1600/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);const result=canvas.toDataURL(file.type==='image/jpeg'?'image/jpeg':'image/png',.85);if(result.length>4_000_000)throw new Error('画像が大きすぎます。小さい画像を選択してください。');return result}finally{URL.revokeObjectURL(url)}
}
