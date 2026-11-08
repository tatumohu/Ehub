import type {Express} from 'express';
import type Database from 'better-sqlite3';
type DB=Database.Database;
export function setupVision(db:DB){
  for(const name of ['projects','ideas']){
    const columns=(db.pragma(`table_info(${name})`) as any[]).map(c=>c.name);
    for(const [column,type] of [['images','TEXT'],['vision_edited_at','TEXT'],...(name==='projects'?[['inherited_vision_id','INTEGER'],['inherited_vision_type','TEXT']]:[])])
      if(!columns.includes(column))db.exec(`ALTER TABLE ${name} ADD COLUMN ${column} ${type}`);
  }
  const commentColumns=(db.pragma('table_info(comments)') as any[]).map(c=>c.name);
  for(const column of ['edited_at','deleted_at'])if(!commentColumns.includes(column))db.exec(`ALTER TABLE comments ADD COLUMN ${column} TEXT`);
  db.exec('CREATE TABLE IF NOT EXISTS deleted_visions (item_type TEXT NOT NULL,item_id INTEGER NOT NULL,deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(item_type,item_id))');
}
const invalid=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status})};
function table(type:string){if(!['project','idea'].includes(type))invalid('投稿の種類が不正です。');return type==='project'?'projects':'ideas'}
function visionRow(db:DB,type:string,id:number){return db.prepare(`SELECT v.*, v.images AS images, '${type}' AS type,u.username AS author_name,u.avatar AS author_avatar,strftime('%Y-%m-%dT%H:%M:%SZ',v.created_at) AS created_at FROM ${table(type)} v JOIN users u ON u.id=v.author_id WHERE v.id=?`).get(id) as any;}
function publicVision(post:any){return post&&!post.project_post_deleted_at&&!Number(post.is_private)&&!Number(post.is_recruitment)&&!Number(post.is_buyout)&&post.status!=='completed'}
export function validateInheritedVision(db:DB,author:number,value:any){if(value==null)return null;if(!value||!Number.isSafeInteger(value.id)||value.id<1)invalid('引き継ぎ元が不正です。');const post=visionRow(db,value.type,value.id);if(!post)invalid('引き継ぎ元のVisionが見つかりません。',404);if(Number(post.author_id)!==Number(author)||!publicVision(post))invalid('自分が公開したVisionを選択してください。',403);return {id:value.id,type:value.type};}
const escapeText=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\n/g,'<br>');
export function validateContent(text:any,images:any,existing:string[]=[]){
    if(typeof text!=='string'||(!text.trim()&&(!Array.isArray(images)||!images.length)))invalid('本文または画像を追加してください。');
    if(!Array.isArray(images)||images.length>4)invalid('画像は4枚まで追加できます。');
    for(const image of images){
      if(existing.includes(image))continue;
      if(typeof image!=='string'||image.length>4_000_000)invalid('画像が大きすぎます。');
      const m=image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
      if(!m)invalid('JPEG・PNG・WebP画像を使用してください。');
      const b=Buffer.from(m[2],'base64');
      if(!((m[1]==='jpeg'&&b[0]===255&&b[1]===216)||(m[1]==='png'&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(m[1]==='webp'&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')))invalid('画像データが不正です。');
    }
}
export function installVision(app:Express,getDb:()=>Database.Database,onChanged?:(change:{type:string;id:number;deleted?:boolean})=>void) {
  const route=(fn:(req:any,res:any,db:DB)=>void)=>(req:any,res:any)=>{try{fn(req,res,getDb())}catch(e:any){res.status(e.status||500).json({error:e.status?e.message:'Visionを読み込めませんでした。'})}};
  app.get('/api/vision/own',route((req,res,db)=>{
    const id=Number(req.query.user_id);if(!Number.isSafeInteger(id)||!db.prepare('SELECT id FROM users WHERE id=?').get(id))invalid('サインインしてください。',401);
    const rows=['project','idea'].flatMap(type=>(db.prepare(`SELECT id FROM ${table(type)} WHERE author_id=? AND COALESCE(is_private,0)=0 AND COALESCE(is_recruitment,0)=0 AND COALESCE(is_buyout,0)=0 ${type==='project'?"AND status='active'":''}`).all(id) as any[]).map(row=>visionRow(db,type,row.id)));
    res.json(rows.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id));
  }));
  app.get('/api/vision/quote-counts',route((_req,res,db)=>{
    const counts=db.prepare(`SELECT quoted_item_type AS type,quoted_item_id AS id,COUNT(*) AS count FROM (SELECT quoted_item_type,quoted_item_id FROM projects WHERE COALESCE(is_private,0)=0 AND COALESCE(is_recruitment,0)=0 AND COALESCE(is_buyout,0)=0 UNION ALL SELECT quoted_item_type,quoted_item_id FROM ideas WHERE COALESCE(is_private,0)=0 AND COALESCE(is_recruitment,0)=0 AND COALESCE(is_buyout,0)=0) WHERE quoted_item_id IS NOT NULL GROUP BY quoted_item_type,quoted_item_id`).all() as any[];
    res.json(Object.fromEntries(counts.map(row=>[`${row.type}:${row.id}`,row.count])));
  }));
  app.get('/api/vision/:type/:id/quotes',route((req,res,db)=>{
    const id=Number(req.params.id),source=visionRow(db,req.params.type,id);if(!source)invalid('元の投稿が見つかりません。',404);if(Number(source.is_private))invalid('この投稿の引用は表示できません。',403);
    const rows=['project','idea'].flatMap(type=>(db.prepare(`SELECT id FROM ${table(type)} WHERE quoted_item_id=? AND quoted_item_type=? AND COALESCE(is_private,0)=0 AND COALESCE(is_recruitment,0)=0 AND COALESCE(is_buyout,0)=0`).all(id,req.params.type) as any[]).map(row=>visionRow(db,type,row.id)));
    res.json(rows.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id));
  }));
  app.get('/api/projects/:id/inherited-vision',route((req,res,db)=>{
    const project=db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id) as any;if(!project)invalid('Projectが見つかりません。',404);
    const viewer=Number(req.query.user_id);let permitted:number[]=[];try{permitted=JSON.parse(project.permitted_users||'[]').map(Number)}catch{}
    if(Number(project.is_private)&&viewer!==Number(project.author_id)&&!permitted.includes(viewer))invalid('このProjectは表示できません。',403);
    if(!project.inherited_vision_id){res.json({vision:null});return}
    const post=visionRow(db,project.inherited_vision_type,project.inherited_vision_id);
    res.json(publicVision(post)?{vision:post}:{vision:null,unavailable:true,deleted:deleted(db,project.inherited_vision_type,project.inherited_vision_id)});
  }));
  const replyForChange=(req:any,db:DB)=>{
    const type=req.params.type,id=Number(req.params.id),actor=Number(req.body.user_id);
    if(!Number.isSafeInteger(actor)||!db.prepare('SELECT id FROM users WHERE id=?').get(actor))invalid('サインインしてください。',401);
    const post=visionRow(db,type,id);
    if(!post)invalid('この投稿は削除されています。',404);
    if(Number(post.is_recruitment)||Number(post.is_buyout)||post.status!=='active')invalid('この投稿はVisionではありません。');
    let permitted:number[]=[];try{permitted=JSON.parse(post.permitted_users||'[]').map(Number)}catch{}
    if(Number(post.is_private)&&Number(post.author_id)!==actor&&!permitted.includes(actor))invalid('この投稿は表示できません。',403);
    const reply=db.prepare(`SELECT * FROM comments WHERE id=? AND ${type}_id=?`).get(req.params.replyId,id) as any;
    if(!reply||reply.deleted_at)invalid('この返信は削除されたか、存在しません。',404);
    if(Number(reply.user_id)!==actor)invalid('自分の返信だけを変更できます。',403);
    return {type,id,reply};
  };
  app.patch('/api/vision/:type/:id/replies/:replyId',route((req,res,db)=>{
    const {type,id,reply}=replyForChange(req,db);
    if(typeof req.body.content!=='string'||!req.body.content.trim())invalid('返信を入力してください。');
    db.prepare("UPDATE comments SET content=?,edited_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(req.body.content,reply.id);
    onChanged?.({type,id});res.json({updated:true});
  }));
  app.delete('/api/vision/:type/:id/replies/:replyId',route((req,res,db)=>{
    const {type,id,reply}=replyForChange(req,db);
    // Keep the parent ID so other people's replies retain their original context.
    db.prepare("UPDATE comments SET content='',deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(reply.id);
    onChanged?.({type,id});res.json({deleted:true});
  }));
  const deleted=(db:DB,type:string,id:number)=>!!db.prepare('SELECT 1 FROM deleted_visions WHERE item_type=? AND item_id=?').get(type,id);
  app.get('/api/vision/:type/:id/reference',route((req,res,db)=>{
    const {type}=req.params,id=Number(req.params.id),post=visionRow(db,type,id);
    if(!post||post.project_post_deleted_at){res.json({vision:null,deleted:!!post?.project_post_deleted_at||deleted(db,type,id),deletedProject:!!post?.project_post_deleted_at,unavailable:true});return}
    const viewer=Number(req.query.user_id);let allowed=false;try{allowed=Number(post.is_recruitment)===1&&(viewer===Number(post.author_id)||JSON.parse(post.permitted_users||'[]').map(Number).includes(viewer))}catch{}
    res.json(Number(post.is_private)&&!allowed?{vision:null,unavailable:true}:{vision:post});
  }));
  const owned=(req:any,db:DB)=>{
    const type=req.params.type,id=Number(req.params.id),actor=Number(req.body.user_id);
    if(!Number.isSafeInteger(actor)||!db.prepare('SELECT id FROM users WHERE id=?').get(actor))invalid('サインインしてください。',401);
    const post=visionRow(db,type,id);
    if(!post)invalid('このVisionは削除されています。',404);
    if(Number(post.author_id)!==actor)invalid('自分のVisionだけを変更できます。',403);
    if(Number(post.is_recruitment)||Number(post.is_buyout)||post.status!=='active')invalid('この投稿はVisionではありません。',400);
    return {type,id,post};
  };
  app.patch('/api/vision/:type/:id',route((req,res,db)=>{
    const {type,id,post}=owned(req,db),{text,images}=req.body;
    let existing:string[]=[];try{existing=JSON.parse(post.images||'[]')}catch{}
    if(!Array.isArray(existing))existing=[];
    if(!existing.length&&post.image)existing=[post.image];
    validateContent(text,images,existing);
    db.prepare(`UPDATE ${table(type)} SET description=?,image=?,images=?,vision_edited_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).run(`<p>${escapeText(text)}</p>`,images[0]||'',JSON.stringify(images),id);
    onChanged?.({type,id});res.json(visionRow(db,type,id));
  }));
  app.delete('/api/vision/:type/:id',route((req,res,db)=>{
    const {type,id}=owned(req,db);
    db.transaction(()=>{
      db.prepare('INSERT INTO deleted_visions(item_type,item_id) VALUES (?,?)').run(type,id);
      for(const name of ['likes','archives','stage_evaluations','notifications'])db.prepare(`DELETE FROM ${name} WHERE item_type=? AND item_id=?`).run(type,id);
      // Personal notes survive deletion of the post they referenced.
      if(type==='project')db.prepare('UPDATE memos SET project_id=NULL WHERE project_id=?').run(id);
      else db.prepare('UPDATE projects SET latest_idea_id=NULL,latest_idea_at=NULL WHERE latest_idea_id=?').run(id);
      db.prepare(`DELETE FROM ${table(type)} WHERE id=?`).run(id);
    })();
    onChanged?.({type,id,deleted:true});res.json({deleted:true});
  }));
  app.post('/api/vision',(req,res)=>{
    const db=getDb(),id=Number(req.body.author_id),text=req.body.text,images=req.body.images??[];
    if(!Number.isSafeInteger(id)||id<1||!db.prepare('SELECT id FROM users WHERE id=?').get(id))return res.status(401).json({error:'サインインしてください。'});
    try{validateContent(text,images)}catch(e:any){return res.status(e.status||400).json({error:e.message})}
    const quote=req.body.quote;
    if(quote){
      if(!['project','idea'].includes(quote.type)||!Number.isSafeInteger(quote.id)||quote.id<1)return res.status(400).json({error:'引用先が不正です。'});
      const target=db.prepare(`SELECT author_id,is_private,permitted_users,project_post_deleted_at FROM ${quote.type==='project'?'projects':'ideas'} WHERE id=?`).get(quote.id) as any;
      if(!target||target.project_post_deleted_at)return res.status(404).json({error:'引用先が見つかりません。'});
      if(target.is_private)return res.status(403).json({error:'非公開の投稿は引用できません。'});
    }
    try{
      const result=db.prepare('INSERT INTO projects (title,description,image,images,author_id,is_recruitment,is_private,quoted_item_id,quoted_item_type) VALUES (?,?,?,?,?,0,0,?,?)').run('Vision',`<p>${escapeText(text)}</p>`,images[0]||'',JSON.stringify(images),id,quote?.id??null,quote?.type??null);
      res.json({id:Number(result.lastInsertRowid),type:'project'});
    }catch{res.status(500).json({error:'投稿を保存できませんでした。'})}
  });
}
