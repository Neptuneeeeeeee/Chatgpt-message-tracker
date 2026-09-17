// Real installed extension + real Chrome engine, on a LOCAL fixture intercepted before network.
// This does NOT log in to ChatGPT and is NOT a claim of live-account website verification.
// Uses a fresh temporary profile, a private CDP pipe, and waits for Chrome to exit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const extensionRoot=path.resolve(process.env.CMT_EXTENSION_ROOT||root);
const executable=process.env.CMT_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if(!fs.existsSync(executable))throw new Error('Set CMT_CHROME to a Chrome executable');
const out=path.resolve(process.argv[2]||'/tmp/cmt-chrome-verification');fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cmt-chrome-'));
const browser=spawn(executable,['--headless=new',`--user-data-dir=${profile}`,'--remote-debugging-pipe','--enable-unsafe-extension-debugging','--no-first-run','--no-default-browser-check','--disable-background-networking'],{stdio:['ignore','pipe','pipe','pipe','pipe']});
let closed=false,stderr='',sequence=0,buffer='',eventHandler=()=>{};
const pending=new Map(),errors=[];
const exit=new Promise(resolve=>browser.once('close',(code,signal)=>{closed=true;resolve({code,signal});}));
browser.stderr.on('data',d=>{stderr=(stderr+d).slice(-200000);});
browser.once('error',e=>errors.push(String(e)));
browser.stdio[4].setEncoding('utf8');
browser.stdio[4].on('data',chunk=>{
 buffer+=chunk;let pos;
 while((pos=buffer.indexOf('\0'))>=0){
  const raw=buffer.slice(0,pos);buffer=buffer.slice(pos+1);if(!raw)continue;
  const m=JSON.parse(raw);
  if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}
  else eventHandler(m);
 }
});
function cdp(method,params={},sessionId,timeoutMs=30000){
 return new Promise((resolve,reject)=>{
  const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},timeoutMs);
  pending.set(id,{resolve,reject,timer});browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');
 });
}
async function evaluate(session,expression){
 const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},session);
 if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){
 const end=Date.now()+12000;while(Date.now()<end){if(await fn())return;await pause(40);}throw new Error('Timed out: '+label);
}
async function target(url='about:blank'){
 const {targetId}=await cdp('Target.createTarget',{url});const {sessionId}=await cdp('Target.attachToTarget',{targetId,flatten:true});
 await cdp('Runtime.enable',{},sessionId);return sessionId;
}
const fixture=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>LOCAL Tracker verification fixture — not ChatGPT</title></head><body><main><h1>Local extension verification</h1><section id="messages"></section><form><div id="prompt-textarea" contenteditable="true" style="width:500px;min-height:50px;border:1px solid"></div><button id="mode" type="button" aria-haspopup="menu">高</button><button id="composer-submit-button" type="button" data-testid="send-button" aria-label="发送提示词">Send</button></form></main><script>
let serial=0;window.fixture={hold:false};
document.getElementById('composer-submit-button').addEventListener('click',()=>{
 if(window.fixture.hold)return;
 const input=document.getElementById('prompt-textarea');const el=document.createElement('div');
 el.dataset.messageAuthorRole='user';el.dataset.messageId='local-'+(++serial);el.textContent=input.textContent;
 input.textContent='';document.getElementById('messages').append(el);
});
</script></body></html>`;
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'src/site-locales.js'),'utf8'),context);
const locales=context.ChatGPTTrackerSiteLocales;
let passed=0,report={kind:'real Chrome / installed MV3 extension / intercepted LOCAL fixture',liveChatGPTAccountVerified:false,profileIsolated:true,tests:[]};
try{
 report.browser=await cdp('Browser.getVersion',{},undefined,60000);
 const {id}=await cdp('Extensions.loadUnpacked',{path:extensionRoot});report.extensionId=id;
 report.packagedExtensionTested=extensionRoot!==root;
 const popup=await target(`chrome-extension://${id}/src/popup.html`);
 await until(()=>evaluate(popup,'Boolean(window.ChatGPTTrackerCore)'), 'popup scripts');
 await evaluate(popup,`chrome.storage.local.set({'cmt.settings':{...ChatGPTTrackerCore.DEFAULT_SETTINGS,showWidget:true},'cmt.usage':{version:1,entries:[]}})`);
 const page=await target();
 eventHandler=m=>{
  if(m.method==='Fetch.requestPaused'&&m.sessionId===page){
   const p=m.params;
   const action=p.request.url==='https://chatgpt.com/__cmt-verification__'
    ?cdp('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'}],body:Buffer.from(fixture).toString('base64')},page)
    :cdp('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'},page);
   action.catch(e=>errors.push(String(e)));
  }
  if(m.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(m.params.exceptionDetails));
  if(m.method==='Runtime.consoleAPICalled'&&['error','warning'].includes(m.params.type))errors.push(JSON.stringify(m.params.args));
 };
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*'}]},page);
 await cdp('Page.enable',{},page);
 await cdp('Page.navigate',{url:'https://chatgpt.com/__cmt-verification__'},page);
 await until(()=>evaluate(page,"!!document.querySelector('#cmt-widget')"),'automatic content-script injection');
 const entries=()=>evaluate(popup,"chrome.storage.local.get('cmt.usage').then(x=>x['cmt.usage'].entries)");
 for(const [locale,row] of Object.entries(locales))for(const [mode,labels] of Object.entries(row.modes)){
  const text=`local-${locale}-${mode}`;
  await evaluate(page,`document.documentElement.lang=${JSON.stringify(locale)};document.querySelector('#mode').textContent=${JSON.stringify(labels[0])};document.querySelector('#composer-submit-button').setAttribute('aria-label',${JSON.stringify(row.send[0])});document.querySelector('#prompt-textarea').textContent=${JSON.stringify(text)};document.querySelector('#composer-submit-button').click();`);
  await until(async()=> (await entries()).length===passed+1,`${locale}/${mode} count`);
  const actual=await entries();assert.equal(actual.at(-1).modeId,mode,`${locale}/${mode}`);
  passed++;report.tests.push({locale,mode,pass:true});
  if(mode==='pro'){
    console.log('Chrome verified',locale);
    fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({completedTests:report.tests.length,locale,profile},null,2));
  }
 }
 // Same text twice must still count twice with distinct DOM message IDs.
 for(let i=0;i<2;i++){
  await evaluate(page,"document.documentElement.lang='zh-CN';document.querySelector('#mode').textContent='高';document.querySelector('#prompt-textarea').textContent='继续';document.querySelector('#composer-submit-button').click()");
  await until(async()=> (await entries()).length===passed+1,'identical genuine sends');passed++;
 }
 report.tests.push({case:'identical text, distinct message IDs',pass:true});
 await evaluate(page,"window.fixture.hold=true;document.querySelector('#composer-submit-button').dataset.testid='stop-button';document.querySelector('#composer-submit-button').setAttribute('aria-label','停止回答');document.querySelector('#composer-submit-button').click()");
 await pause(250);assert.equal((await entries()).length,passed);report.tests.push({case:'stop is not send',pass:true});
 await evaluate(page,"document.querySelector('#mode').innerHTML='<span style=\"display:none\">Pro</span>'");
 await until(()=>evaluate(page,"document.querySelector('#cmt-mode-select').title.includes('未识别')"),'hidden label fails closed');
 report.tests.push({case:'real CSS-hidden label ignored',pass:true});
 const screenshot=await cdp('Page.captureScreenshot',{format:'png'},page);
 fs.writeFileSync(path.join(out,'local-fixture.png'),Buffer.from(screenshot.data,'base64'));
 // Reinject in the extension's actual isolated world using the unchanged scripting permission.
 const before=await evaluate(page,"document.querySelector('#cmt-widget').dataset.cmtInstance");
 await evaluate(popup,`chrome.tabs.query({url:'https://chatgpt.com/__cmt-verification__'}).then(t=>chrome.scripting.executeScript({target:{tabId:t[0].id},files:${JSON.stringify(['src/shared.js','src/site-locales.js','src/site-detection.js','src/content.js'])}}))`);
 await until(()=>evaluate(page,`document.querySelector('#cmt-widget')?.dataset.cmtInstance!==${JSON.stringify(before)}`),'reinjection takeover');
 await evaluate(page,"window.fixture.hold=false;document.querySelector('#mode').textContent='极高';document.querySelector('#composer-submit-button').dataset.testid='send-button';document.querySelector('#composer-submit-button').setAttribute('aria-label','发送提示词');document.querySelector('#prompt-textarea').textContent='after reinjection';document.querySelector('#composer-submit-button').click()");
 await until(async()=> (await entries()).length===passed+1,'one count after reinjection');passed++;
 assert.equal((await entries()).at(-1).modeId,'extra-high');await pause(300);assert.equal((await entries()).length,passed);
 report.tests.push({case:'isolated-world reinjection counts once',pass:true});
 await evaluate(page,`document.documentElement.lang='en-US';document.querySelector('#mode').innerHTML='<span>Extra <b>High</b></span><span>Longer reasoning</span>';document.querySelector('#prompt-textarea').textContent='nested label';document.querySelector('#composer-submit-button').click()`);
 await until(async()=> (await entries()).length===passed+1,'nested Extra High label');passed++;
 assert.equal((await entries()).at(-1).modeId,'extra-high');report.tests.push({case:'nested label keeps Extra High',pass:true});
 await evaluate(page,`window.fixture.hold=true;document.querySelector('#prompt-textarea').textContent='delayed DOM text';document.querySelector('#composer-submit-button').click();document.querySelector('#prompt-textarea').textContent='';const delayed=document.createElement('div');delayed.dataset.messageAuthorRole='user';delayed.dataset.messageId='local-delayed';document.querySelector('#messages').append(delayed);setTimeout(()=>delayed.textContent='delayed DOM text',120)`);
 await until(async()=> (await entries()).length===passed+1,'incrementally rendered user message');passed++;
 report.tests.push({case:'empty message shell later receives text',pass:true});
 await evaluate(page,`history.replaceState({},'', '/c/local-existing');document.querySelector('#prompt-textarea').textContent='should not count';document.querySelector('#composer-submit-button').click();document.querySelector('#prompt-textarea').textContent='';history.pushState({},'', '/c/another-history');const historical=document.createElement('div');historical.dataset.messageAuthorRole='user';historical.dataset.messageId='historical';historical.textContent='should not count';document.querySelector('#messages').append(historical)`);
 await pause(300);assert.equal((await entries()).length,passed);report.tests.push({case:'cross-conversation history does not count',pass:true});
 if(process.env.CMT_STORE_ASSETS){
  const {captureStoreAssets}=await import('./capture-store-assets.mjs');
  report.storeAssets=await captureStoreAssets({directory:path.resolve(process.env.CMT_STORE_ASSETS),extensionId:id,cdp,evaluate,target});
 }
 assert.deepEqual(errors,[],'no browser runtime errors');report.pass=true;report.sendRecords=passed;
}catch(e){report.pass=false;report.error=String(e.stack||e);process.exitCode=1;}
finally{
 if(!closed){try{await cdp('Browser.close');}catch{} }
 const watchdog=setTimeout(()=>{if(!closed)browser.kill('SIGKILL');},7000);
 report.browserExit=await exit;clearTimeout(watchdog);
 for(const p of pending.values())clearTimeout(p.timer);
 report.runtimeErrors=errors;
 fs.writeFileSync(path.join(out,'chrome-stderr.log'),stderr);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 fs.rmSync(profile,{recursive:true,force:true});
 console.log(JSON.stringify({...report,tests:report.tests.length},null,2));
}
