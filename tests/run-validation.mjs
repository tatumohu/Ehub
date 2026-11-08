import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
const dir=await mkdtemp(path.join(os.tmpdir(),'ehub-validation-'));
const port=process.env.TEST_PORT||'3101';
const base=`http://localhost:${port}`;
const validationId=randomUUID();
const server=spawn(process.execPath,['--import','tsx','server.ts'],{env:{...process.env,PORT:port,NODE_ENV:(process.argv.includes('--sections')||process.argv.includes('--cards')||process.argv.includes('--card-text')||process.argv.includes('--card-tabs')||process.argv.includes('--card-orientation')||process.argv.includes('--card-exchange')||process.argv.includes('--vision-social')||process.argv.includes('--vision-journey')||process.argv.includes('--vision-relations')||process.argv.includes('--vision-manage')||process.argv.includes('--reply-manage')||process.argv.includes('--vision-lifecycle')||process.argv.includes('--project-manage')||process.argv.includes('--vision-actions')||process.argv.includes('--project-light')||process.argv.includes('--card-visibility')||process.argv.includes('--drafts')||process.argv.includes('--composer-ui')||process.argv.includes('--retired-tools')||process.argv.includes('--project-back'))?'production':process.env.NODE_ENV,EHUB_VALIDATION_ID:validationId,STRIPE_SECRET_KEY:'sk_test_validation_only',STRIPE_WEBHOOK_SECRET:'whsec_validation_only',EHUB_DB_PATH:path.join(dir,'test.db')},stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
const run=file=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[file],{env:{...process.env,TEST_URL:base},stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(file+' failed')))});
try{
 let ready=false;
 for(let i=0;i<100;i++){
  if(server.exitCode!==null||server.signalCode!==null)throw new Error('Test server exited: '+log.slice(-2000));
  try{const r=await fetch(base+'/api/test');if(r.ok&&(await r.json()).validation_id===validationId){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 if(!ready)throw new Error('Server not ready');
 if (!process.argv.includes('--card-text')) {
 await run('tests/service-validation.mjs');
 await run('tests/workflows-validation.mjs');
 }
 if (process.argv.includes('--project-back')) await run('tests/project-back-validation.mjs');
 if (process.argv.includes('--retired-tools')) await run('tests/retired-tools-validation.mjs');
 if (process.argv.includes('--composer-ui')) await run('tests/project-composer-ui-validation.mjs');
 if (process.argv.includes('--drafts')) await run('tests/draft-validation.mjs');
 if (process.argv.includes('--card-visibility')) await run('tests/card-visibility-validation.mjs');
 if (process.argv.includes('--project-light')) await run('tests/project-light-validation.mjs');
 if (process.argv.includes('--vision-actions')) await run('tests/vision-actions-validation.mjs');
 if (process.argv.includes('--project-manage')) await run('tests/project-post-manage-validation.mjs');
 if (process.argv.includes('--vision-lifecycle')) await run('tests/vision-full-lifecycle-validation.mjs');
 if (process.argv.includes('--reply-manage')) await run('tests/vision-reply-manage-validation.mjs');
 if (process.argv.includes('--vision-manage')) await run('tests/vision-manage-validation.mjs');
 if (process.argv.includes('--vision-relations')) await run('tests/vision-inherit-replies-validation.mjs');
 if (process.argv.includes('--vision-journey')) await run('tests/vision-journey-validation.mjs');
 if (process.argv.includes('--vision-social')) await run('tests/vision-social-ui-validation.mjs');
 if (process.argv.includes('--card-exchange')) await run('tests/card-qr-exchange-validation.mjs');
 if (process.argv.includes('--card-orientation')) await run('tests/card-orientation-validation.mjs');
 if (process.argv.includes('--card-tabs')) await run('tests/following-card-tabs-validation.mjs');
 if (process.argv.includes('--card-text')) await run('tests/card-text-workflow-validation.mjs');
 if(process.argv.includes('--cards')) {await run('tests/business-card-validation.mjs');await run('tests/card-designer-validation.mjs');await run('tests/card-text-workflow-validation.mjs');await run('tests/following-card-tabs-validation.mjs');await run('tests/card-orientation-validation.mjs');await run('tests/card-qr-exchange-validation.mjs');}
 if(process.argv.includes('--sections')) await run('tests/section-ui-validation.mjs');
 if(process.argv.includes('--navigation')) {
  await run('tests/navigation-redesign.mjs');
  await run('tests/vision-expansion-validation.mjs');
 }
 if(process.argv.includes('--responsive')) {
  await run('tests/responsive-validation.mjs');
  await run('tests/responsive-interactions.mjs');
  await run('tests/bottom-navigation-validation.mjs');
 }
 if(process.argv.includes('--browser')){
  await run('tests/browser-validation.mjs');
  await run('tests/retired-tools-validation.mjs');
  await run('tests/login-ui-validation.mjs');
 }
}catch(e){console.error(e.message);console.error(log.slice(-3000));process.exitCode=1}
finally{if(server.exitCode===null&&server.signalCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve))}await rm(dir,{recursive:true,force:true})}
