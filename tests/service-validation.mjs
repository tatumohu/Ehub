import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://localhost:3100';
const results=[];
async function request(path, method='GET',body) {
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','x-user-id':String(user?.id||1)},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text.slice(0,100)}
 return {status:r.status,data};
}
async function check(name,fn){try{await fn();results.push({name,ok:true})}catch(e){results.push({name,ok:false,error:e.message})}}
let user,idea,project,contract;
await check('register, verify and login',async()=>{
 const email=`qa-${Date.now()}@example.invalid`;
 let r=await request('/api/register','POST',{email,password:'test-only-password',username:`qa-${Date.now()}`,account_type:'individual'});assert.equal(r.status,200,JSON.stringify(r));
 r=await request('/api/verify','POST',{token:r.data.token});assert.equal(r.status,200);user=r.data;
 r=await request('/api/login','POST',{email,password:'test-only-password'});assert.equal(r.data.id,user.id);
});
await check('create and read idea',async()=>{
 let r=await request('/api/ideas','POST',{title:'QA Vision',description:'<p>Test vision</p>',author_id:user.id});assert.equal(r.status,200,JSON.stringify(r));idea=r.data.id;
 r=await request(`/api/ideas/${idea}`);assert.equal(r.data.title,'QA Vision');
});
await check('create and read project',async()=>{
 let r=await request('/api/projects','POST',{title:'QA Project',description:'Project test',author_id:user.id});assert.equal(r.status,200,JSON.stringify(r));project=r.data.id;
 r=await request(`/api/projects/${project}`);assert.equal(r.data.title,'QA Project');
});
await check('retired memo utility returns 410',async()=>{
 for(const path of ['/api/memos','/api/memos/1','/api/memo_folders','/api/memo_folders/1'])for(const method of ['GET','POST','PUT','DELETE'])assert.equal((await request(path,method,method==='GET'?undefined:{user_id:user.id,title:'retired'})).status,410);
});
await check('contract create, read, delete',async()=>{
 let r=await request('/api/contracts','POST',{author_id:user.id,title:'QA NDA',body:'QA contract',type:'nda'});assert.equal(r.status,200,JSON.stringify(r));contract=r.data.id;
 r=await request(`/api/contracts/${contract}?user_id=${user.id}`);assert.equal(r.status,200,JSON.stringify(r));
 r=await request(`/api/contracts/${contract}`,'DELETE',{user_id:user.id});assert.equal(r.status,200,JSON.stringify(r));
});
const source=fs.readFileSync('server.ts','utf8');
const routes=[...source.matchAll(/app\.get\('([^']+)'/g)].map(m=>m[1]).filter(p=>p.startsWith('/api/')&&!/auth\/google|stripe\/(return|verify-session)/.test(p));
for(const route of routes){await check('GET '+route,async()=>{
 const p=route.replace(/\([^)]*\)/g,'').replace(/:type\b|:itemType\b/g,'idea').replace(/:projectId\b/g,String(project||1)).replace(/:ideaId\b/g,String(idea||1)).replace(/:userId\b|:other_user_id\b/g,String(user?.id||1)).replace(/:\w+/g,'1');
 const r=await request(p+`?user_id=${user?.id||1}&viewer_id=${user?.id||1}&type=idea&item_type=idea&item_id=${idea||1}&q=QA`);
 assert.ok(r.status<500,JSON.stringify(r));assert.notEqual(typeof r.data,'string','Expected JSON response');
});}
fs.writeFileSync('/tmp/ehub-api-validation.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({checks:results.length,passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok)},null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
