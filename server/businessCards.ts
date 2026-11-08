import {validateCardDesign} from '../shared/businessCardDesign';
import type { Express, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
type DB = Database.Database;
export function setupBusinessCards(db:DB) {
  db.exec(`CREATE TABLE IF NOT EXISTS business_cards (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, company TEXT DEFAULT '', role TEXT DEFAULT '', email TEXT DEFAULT '',
    phone TEXT DEFAULT '', website TEXT DEFAULT '', style TEXT DEFAULT 'blue', image TEXT DEFAULT '',
    source TEXT DEFAULT 'empty', share_token TEXT NOT NULL UNIQUE, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS collected_business_cards (
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    collected_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(owner_id,contact_user_id)
  );`);
  if (!(db.pragma('table_info(business_cards)') as any[]).some(c => c.name === 'design')) db.exec("ALTER TABLE business_cards ADD COLUMN design TEXT");
}
const fields='user_id,name,company,role,email,phone,website,style,image,source,updated_at,design';
function decodeCard(row:any) { return row ? {...row, design: row.design ? JSON.parse(row.design) : null} : null; }
function visibleCard(db:DB,owner:number,viewer:number|undefined,row:any) {
  if(!row||!['created','photo'].includes(row.source)||!viewer)return null;
  const allowed=owner===viewer||db.prepare('SELECT 1 FROM subscriptions WHERE (subscriber_id=? AND subscribed_to_id=?) OR (subscriber_id=? AND subscribed_to_id=?)').get(owner,viewer,viewer,owner);
  return allowed?decodeCard(row):null;
}
function fail(message:string,status=400):never {throw Object.assign(new Error(message),{status})}
export function installBusinessCards(app:Express,getDb:()=>DB,notify:(target:number,from:number)=>void) {
  const wrap=(fn:(req:Request,res:Response,db:DB)=>void)=>(req:Request,res:Response)=>{try{fn(req,res,getDb())}catch(e:any){res.status(e.status||500).json({error:e.status?e.message:'名刺の処理に失敗しました。'})}};
  const actor=(req:Request,db:DB)=>{const id=Number(req.headers['x-user-id']);if(!Number.isSafeInteger(id)||id<=0||!db.prepare('SELECT id FROM users WHERE id=?').get(id))fail('サインインしてください。',401);return id};
  const ensure=(db:DB,id:number)=>{
    const user=db.prepare('SELECT username FROM users WHERE id=?').get(id) as any;
    if(!user)fail('ユーザーが見つかりません。',404);
    db.prepare('INSERT OR IGNORE INTO business_cards (user_id,name,share_token) VALUES (?,?,?)').run(id,user.username,randomUUID());
    return db.prepare('SELECT * FROM business_cards WHERE user_id=?').get(id) as any;
  };
  app.get('/api/users/:id/business-card',wrap((req,res,db)=>{
    const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0)fail('ユーザーIDが不正です。');
    if(!db.prepare('SELECT id FROM users WHERE id=?').get(id))fail('ユーザーが見つかりません。',404);
    const viewer=Number(req.headers['x-user-id']);
    res.json({card:visibleCard(db,id,Number.isSafeInteger(viewer)&&viewer>0?viewer:undefined,db.prepare(`SELECT ${fields} FROM business_cards WHERE user_id=?`).get(id))});
  }));
  app.post('/api/business-cards/identity',wrap((req,res,db)=>{const id=actor(req,db);const card=ensure(db,id);res.json({token:card.share_token,user_id:id})}));
  app.put('/api/users/:id/business-card',wrap((req,res,db)=>{
    const id=actor(req,db);if(id!==Number(req.params.id))fail('他のユーザーの名刺は編集できません。',403);
    const text=(key:string,max=200)=>{const v=req.body[key]??'';if(typeof v!=='string'||v.length>max)fail('入力内容が長すぎるか不正です。');return v.trim()};
    const name=text('name',120),company=text('company'),role=text('role'),email=text('email',254),phone=text('phone',80),website=text('website',500),style=text('style',20),source=text('source',20),image=req.body.image||'';
    if(!name)fail('氏名を入力してください。');
    if(!['blue','green','slate'].includes(style)||!['created','photo'].includes(source))fail('名刺の形式が不正です。');
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('メールアドレスを確認してください。');
    if(website){try{if(!['http:','https:'].includes(new URL(website).protocol))fail('Webサイトはhttps://またはhttp://から入力してください。')}catch{fail('WebサイトURLを確認してください。')}}
    if(typeof image!=='string'||image.length>4_000_000)fail('画像が大きすぎます。');
    if(image){const m=image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);if(!m)fail('JPEG・PNG・WebP画像を使用してください。');const b=Buffer.from(m[2],'base64');if(!((m[1]==='jpeg'&&b[0]===255&&b[1]===216)||(m[1]==='png'&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(m[1]==='webp'&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')))fail('画像データが不正です。');}
    if(source==='photo'&&!image)fail('名刺の写真を撮影するか、画像を選択してください。');
    let design;try{design=source==='created'?validateCardDesign(req.body.design):null}catch(e:any){fail(e.message)}
    ensure(db,id);
    db.prepare('UPDATE business_cards SET name=?,company=?,role=?,email=?,phone=?,website=?,style=?,image=?,source=?,design=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(name,company,role,email,phone,website,style,source==='photo'?image:'',source,design?JSON.stringify(design):null,id);
    res.json({card:decodeCard(db.prepare(`SELECT ${fields} FROM business_cards WHERE user_id=?`).get(id))});
  }));
  app.get('/api/business-cards/collection',wrap((req,res,db)=>{
    const id=actor(req,db);
    res.json(db.prepare(`SELECT ${fields.split(',').map(field => `c.${field}`).join(',')},u.username,u.avatar,u.account_type,x.collected_at
      FROM collected_business_cards x JOIN users u ON u.id=x.contact_user_id
      JOIN business_cards c ON c.user_id=u.id WHERE x.owner_id=? ORDER BY x.collected_at DESC,x.contact_user_id DESC`).all(id).map((row:any)=>({
        ...(visibleCard(db,row.user_id,id,row)||{user_id:row.user_id,name:row.username,company:'',role:'',email:'',phone:'',website:'',style:'blue',image:'',source:'empty',design:null}),
        username:row.username,avatar:row.avatar,account_type:row.account_type,collected_at:row.collected_at
      })));
  }));
  app.post('/api/business-cards/collect',wrap((req,res,db)=>{
    const owner=actor(req,db),token=req.body.token;
    if(typeof token!=='string'||!/^[a-f0-9-]{36}$/i.test(token))fail('E-hubの名刺QRコードを読み込んでください。');
    const contact=db.prepare('SELECT user_id FROM business_cards WHERE share_token=?').get(token) as any;
    if(!contact)fail('この名刺QRコードは見つかりません。',404);
    if(contact.user_id===owner)fail('自分の名刺は取り込めません。');
    let followed=false;
    db.transaction(()=>{
      followed=db.prepare('INSERT OR IGNORE INTO subscriptions (subscriber_id,subscribed_to_id) VALUES (?,?)').run(owner,contact.user_id).changes>0;
      db.prepare('INSERT OR IGNORE INTO collected_business_cards (owner_id,contact_user_id) VALUES (?,?)').run(owner,contact.user_id);
      if(followed)db.prepare('INSERT INTO notifications (user_id,type,from_user_id) VALUES (?,?,?)').run(contact.user_id,'new_follower',owner);
    })();
    if(followed)notify(contact.user_id,owner);
    const user=db.prepare('SELECT username FROM users WHERE id=?').get(contact.user_id) as any;
    res.json({user_id:contact.user_id,username:user.username,followed,card:visibleCard(db,contact.user_id,owner,db.prepare(`SELECT ${fields} FROM business_cards WHERE user_id=?`).get(contact.user_id))});
  }));
}
