import Stripe from 'stripe';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {io} from 'socket.io-client';
const base=process.env.TEST_URL||'http://localhost:3100';const checks=[];
async function api(p,method='GET',body){const r=await fetch(base+p,{method,headers:{'content-type':'application/json','x-user-id':'1'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify({path:p,status:r.status,data}));return data;}
async function check(name,fn){try{await fn();checks.push({name,ok:true})}catch(e){checks.push({name,ok:false,error:e.message})}}
const user=await api('/api/login/username','POST',{username:'QA-Workflow'});
const idea=await api('/api/ideas','POST',{author_id:user.id,title:'Workflow idea',description:'<p>workflow</p>'});
const project=await api('/api/projects','POST',{author_id:user.id,title:'Workflow project',description:'workflow'});
await check('likes and archives add, count, remove',async()=>{
 for(const name of ['likes','archives']){
 const body={user_id:user.id,item_id:idea.id,item_type:'idea'};
 await api('/api/'+name,'POST',body);
 const r=await api(`/api/${name}/check?user_id=${user.id}&item_id=${idea.id}&item_type=idea`);assert.ok(Object.values(r).some(Boolean));
 await api('/api/'+name,'DELETE',body);
 }
});
await check('idea and project comments',async()=>{
 for(const [type,id] of [['ideas',idea.id],['projects',project.id]]){
 await api(`/api/${type}/${id}/comments`,'POST',{user_id:user.id,content:'QA comment'});
 const r=await api(`/api/${type}/${id}`);assert.ok(r.comments.some(c=>c.content==='QA comment'));
 }
});
await check('cart add, read, remove',async()=>{
 await api('/api/cart','POST',{user_id:user.id,project_id:project.id});
 const cart=await api(`/api/cart?user_id=${user.id}`);assert.ok(cart.some(i=>i.id===project.id||i.project_id===project.id));
 await api(`/api/cart/${project.id}?user_id=${user.id}`,'DELETE');
});
await check('schedule create, RSVP, delete',async()=>{
 const event=await api('/api/schedules','POST',{project_id:project.id,author_id:user.id,title:'QA meeting',start_at:'2026-12-01T09:00:00',end_at:'2026-12-01T10:00:00'});
 const r=await api(`/api/schedules/${event.id}`);assert.equal(r.title,'QA meeting');
 await api(`/api/schedules/${event.id}/rsvp`,'POST',{user_id:user.id,status:'attending'});
 await api(`/api/schedules/${event.id}`,'DELETE');
});
await check('follow and accept membership',async()=>{
 const follower=await api('/api/login/username','POST',{username:'QA-Follower'});
 const r=await api(`/api/ideas/${idea.id}/follow`,'POST',{follower_id:follower.id,reason:'QA',skills:'QA',role:'QA',period:'QA',hours:'1',message:'QA'});
 await api(`/api/follows/${r.id}/accept`,'POST',{});
 const membership=await api(`/api/ideas/${idea.id}/membership?user_id=${follower.id}`);assert.ok(Object.values(membership).some(Boolean));
});
await check('stage evaluation',async()=>{
 await api(`/api/items/idea/${idea.id}/stage_evaluation`,'POST',{user_id:user.id,stage:3});
 const r=await api(`/api/ideas/${idea.id}`);assert.equal(r.stage,3);
});
await check('scout session message persistence and deletion',async()=>{
 const session=await api('/api/scout_sessions','POST',{user_id:user.id,title:'QA session'});
 await api(`/api/scout_sessions/${session.id}/messages`,'POST',{role:'user',content:'QA message'});
 const messages=await api(`/api/scout_sessions/${session.id}/messages`);assert.ok(messages.some(m=>m.content==='QA message'));
 await api(`/api/scout_sessions/${session.id}`,'DELETE');
});
await check('agreed contracts archive instead of delete',async()=>{
 const contract=await api('/api/contracts','POST',{author_id:1,title:'QA agreed contract',body:'QA body'});
 await api('/api/contracts/agreements','POST',{user_id:1,contract_id:contract.id,target_type:'project',target_id:project.id,signature_name:'QA tester'});
 const r=await api(`/api/contracts/${contract.id}`,'DELETE',{});assert.equal(r.is_archived,true);
 const saved=await api(`/api/contracts/${contract.id}`);assert.equal(saved.status,'archived');
});
await check('contract agreement and audit-log lists remain reachable',async()=>{
 assert.ok(Array.isArray(await api('/api/contracts/agreements?target_type=project&target_id='+project.id)));
 assert.ok(Array.isArray(await api('/api/contracts/audit-logs')));
 assert.equal((await api('/api/contracts/-1')).type,'nda');
 assert.equal((await api('/api/contracts/-2')).type,'outsourcing');
});
await check('signed Stripe subscription updates, duplicates, cancellation and invalid signatures',async()=>{
 const stripe=new Stripe('sk_test_validation_only');
 async function webhook(event){
  const payload=JSON.stringify(event);
  const signature=stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_validation_only'});
  const r=await fetch(base+'/api/stripe/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature},body:payload});
  const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));return body;
 }
 const customer='cus_qa_'+Date.now();
 const event={id:'evt_qa_'+Date.now(),type:'checkout.session.completed',data:{object:{customer,subscription:'sub_qa',metadata:{type:'user_subscription',user_id:String(user.id),target_plan:'pro'}}}};
 await webhook(event);assert.equal((await api('/api/users/'+user.id)).plan,'pro');
 assert.equal((await webhook(event)).duplicate,true);
 await webhook({id:event.id+'_cancel',type:'customer.subscription.deleted',data:{object:{customer}}});
 assert.equal((await api('/api/users/'+user.id)).plan,'free');
 const invalid=await fetch(base+'/api/stripe/webhook',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event)});assert.equal(invalid.status,400);
});
await check('realtime chat delivery and history',async()=>{
 const socket=io(base,{transports:['websocket']});
 try{
 await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject)});
 socket.emit('join_project',project.id);
 const message=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Chat delivery timed out')),5000);socket.once('new_message',m=>{clearTimeout(timer);resolve(m)});socket.emit('send_message',{user_id:user.id,project_id:project.id,idea_id:null,recipient_id:null,content:'QA realtime message'})});
 assert.equal(message.content,'QA realtime message');
 const history=await api(`/api/projects/${project.id}/messages?user_id=${user.id}`);assert.ok(history.some(m=>m.content==='QA realtime message'));
 }finally{socket.disconnect()}
});
fs.writeFileSync('/tmp/ehub-workflows-validation.json',JSON.stringify(checks,null,2));
console.log(JSON.stringify({checks:checks.length,passed:checks.filter(r=>r.ok).length,failed:checks.filter(r=>!r.ok)},null,2));if(checks.some(r=>!r.ok))process.exitCode=1;
