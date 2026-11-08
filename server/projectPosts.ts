import type {Express} from 'express';
import type Database from 'better-sqlite3';
import {validateContent} from './vision';
type DB=Database.Database;
const fail=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status})};
const table=(type:string)=>type==='project'?'projects':type==='idea'?'ideas':fail('投稿の種類が不正です。');
const escape=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\n/g,'<br>');
export function setupProjectPosts(db:DB){
 for(const name of ['projects','ideas']){const columns=(db.pragma(`table_info(${name})`) as any[]).map(c=>c.name);for(const c of ['project_edited_at','project_post_deleted_at'])if(!columns.includes(c))db.exec(`ALTER TABLE ${name} ADD COLUMN ${c} TEXT`)}
}
export function installProjectPosts(app:Express,getDb:()=>DB,changed:(change:{type:string;id:number;deleted?:boolean})=>void){
 const route=(handler:(req:any,res:any,db:DB)=>void)=>(req:any,res:any)=>{try{handler(req,res,getDb())}catch(e:any){res.status(e.status||500).json({error:e.status?e.message:'Projectを変更できませんでした。'})}};
 // Reject stale detail links and mutations while retaining non-post records such as chat history.
 for(const [path,name] of [['projects','projects'],['ideas','ideas']])app.use(`/api/${path}/:id`,(req,res,next)=>{const id=Number(req.params.id);if(Number.isSafeInteger(id)){const row=getDb().prepare(`SELECT project_post_deleted_at FROM ${name} WHERE id=?`).get(id) as any;if(row?.project_post_deleted_at)return res.status(404).json({error:'このProjectは削除されています。'})}next()});
 for(const path of ['projects','ideas'])app.use(`/api/${path}`,(req,res,next)=>{if(req.method==='POST'&&req.path==='/'&&req.body.quoted_item_id&&['project','idea'].includes(req.body.quoted_item_type)){const parent=getDb().prepare(`SELECT project_post_deleted_at FROM ${table(req.body.quoted_item_type)} WHERE id=?`).get(req.body.quoted_item_id) as any;if(parent?.project_post_deleted_at)return res.status(404).json({error:'参照先のProjectは削除されています。'})}next()});
 const own=(req:any,db:DB)=>{const type=req.params.type,id=Number(req.params.id),name=table(type),actor=Number(req.body.user_id);if(!Number.isSafeInteger(actor)||!db.prepare('SELECT id FROM users WHERE id=?').get(actor))fail('サインインしてください。',401);const post=db.prepare(`SELECT * FROM ${name} WHERE id=?`).get(id) as any;if(!post||post.project_post_deleted_at)fail('このProjectは削除されたか、存在しません。',404);if(Number(post.author_id)!==actor)fail('自分のProjectだけを変更できます。',403);if(!Number(post.is_recruitment)||Number(post.is_buyout)||post.status!=='active')fail('この投稿はProjectではありません。');return {type,id,name,post}};
 app.patch('/api/project-posts/:type/:id',route((req,res,db)=>{
  const {type,id,name,post}=own(req,db),{title,text,image}=req.body;
  if(typeof title!=='string'||!title.trim())fail('タイトルを入力してください。');
  if(text!==undefined&&typeof text!=='string')fail('本文を入力してください。');
  if(typeof image!=='string')fail('画像が不正です。');
  validateContent('cover',image?[image]:[],post.image?[post.image]:[]);
  const description=text===undefined?post.description:`<p>${escape(text)}</p>`;
  const images=image===post.image?post.images:JSON.stringify(image?[image]:[]);
  // Source Vision, visibility, recruitment type and reply parent IDs cannot be rewritten here.
  db.prepare(`UPDATE ${name} SET title=?,description=?,image=?,images=?,project_edited_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).run(title.trim(),description,image,images,id);
  changed({type,id});res.json({updated:true});
 }));
 app.delete('/api/project-posts/:type/:id',route((req,res,db)=>{
  const {type,id,name}=own(req,db);
  db.transaction(()=>{
   db.prepare(`UPDATE ${name} SET title='削除されたProject',description='',image='',images='[]',tags='[]',status='deleted',project_post_deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).run(id);
   db.prepare(`UPDATE comments SET content='',deleted_at=COALESCE(deleted_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE ${type}_id=?`).run(id);
   if(type==='idea')db.prepare('UPDATE projects SET latest_idea_id=NULL,latest_idea_at=NULL WHERE latest_idea_id=?').run(id);
   for(const name of ['likes','archives','stage_evaluations','notifications'])db.prepare(`DELETE FROM ${name} WHERE item_type=? AND item_id=?`).run(type,id);
  })();
  changed({type,id,deleted:true});res.json({deleted:true});
 }));
}
