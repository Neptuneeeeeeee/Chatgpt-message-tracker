const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const scripts = ['src/shared.js','src/site-locales.js','src/ui-locales.js','src/i18n.js','src/site-detection.js'];
const code = Object.fromEntries([...scripts, 'src/content.js'].map(file => [file, source(file)]));
const clone = value => JSON.parse(JSON.stringify(value));
const settle = async (ms=20) => { await new Promise(resolve => setTimeout(resolve, ms)); };
function boot(html,{lang,settings,entries,url='https://chatgpt.com/c/test'}) {
  const errors=[];
  const virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
  const w=dom.window;
  w.document.documentElement.lang=lang;
  w.HTMLElement.prototype.getBoundingClientRect=function(){return {width:100,height:20,x:0,y:0,top:0,left:0,bottom:20,right:100};};
  const values={'cmt.settings':{showWidget:false,...settings},'cmt.usage':{version:1,entries:clone(entries)}};
  const listeners=new Set();
  w.chrome={runtime:{id:'test-extension',lastError:undefined},storage:{local:{
    get(keys,callback){queueMicrotask(()=>callback(Object.fromEntries(keys.filter(k=>values[k]!==undefined).map(k=>[k,clone(values[k])]))));},
    set(updates,callback){
      const changes={};
      for(const [key,value] of Object.entries(updates)){changes[key]={oldValue:values[key],newValue:clone(value)};values[key]=clone(value);}
      queueMicrotask(()=>{callback();for(const listener of listeners)listener(changes,'local');});
    }
  },onChanged:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}}};
  for(const file of scripts)w.eval(code[file]);
  const modes=clone(w.ChatGPTTrackerCore.DEFAULT_SETTINGS.modes);
  const detector=w.ChatGPTTrackerSiteDetection.createDetector(w.document);
  return {dom,w,document:w.document,values,errors,modes,detector,close:()=>dom.window.close(),async start(){w.eval(code['src/content.js']);await settle();},reload(){w.eval(code['src/content.js']);}};
}
function makePage({lang='zh-CN', label='高', settings={}, entries=[]}={}) {
  const page=boot('<!doctype html><html><body><main><section id="messages"></section><form><div id="prompt-textarea" contenteditable="true"></div><button id="mode" type="button" aria-haspopup="menu"></button><button id="composer-submit-button" type="button" data-testid="send-button" aria-label="发送提示词"><svg><path></path></svg></button></form></main></body></html>',{lang,settings,entries});
  const {w}=page;
  w.document.getElementById('mode').textContent=label;
  const input=w.document.getElementById('prompt-textarea');
  const mode=w.document.getElementById('mode');
  const send=w.document.getElementById('composer-submit-button');
  function draft(text){input.textContent=text;input.dispatchEvent(new w.Event('input',{bubbles:true}));}
  function key(options={}){input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...options}));}
  function message(text,id='msg-'+Math.random()){
    const node=w.document.createElement('div');node.dataset.messageAuthorRole='user';node.dataset.messageId=id;node.textContent=text;
    w.document.getElementById('messages').append(node);return node;
  }
  return {...page,input,mode,send,draft,key,message};
}
// The 2026-09 app shell as observed live: no ids or data-testid, every visited page kept mounted
// (hidden) next to the active one, and user turns keyed by message id.
const shellForm=(placement,label)=>`<form data-chatgpt-composer data-composer-placement="${placement}"><div contenteditable="true" data-composer-markdown role="textbox"></div><button type="button" aria-haspopup="menu" aria-label="选择 ChatGPT 模型" data-codex-intelligence-trigger="true"><span aria-hidden="true"><span>思考强度</span></span><span class="label">${label}</span></button><button class="send" type="submit" aria-label="发送"><svg><path></path></svg></button></form>`;
function makeShellPage({lang='zh-CN', label='高', settings={}, entries=[], atHome=false}={}) {
  const page=boot('<!doctype html><html><body><div id="root"></div></body></html>',{lang,settings,entries,url:atHome?'https://chatgpt.com/':'https://chatgpt.com/c/test'});
  const {w}=page, shell=w.document.getElementById('root');
  function view(placement,label,active){
    const root=w.document.createElement('div');
    root.innerHTML=`<div><section class="turns"></section>${shellForm(placement,label)}</div>`;
    shell.append(root);
    const v={root,turns:root.querySelector('.turns'),input:root.querySelector('[data-composer-markdown]'),mode:root.querySelector('.label'),send:root.querySelector('.send')};
    v.draft=text=>{v.input.textContent=text;v.input.dispatchEvent(new w.Event('input',{bubbles:true}));};
    v.key=(options={})=>v.input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...options}));
    v.turn=(text,id)=>{
      const turn=w.document.createElement('div');turn.dataset.turnKey=id;
      turn.innerHTML=`<div data-chatgpt-search-unit-key="${id}:0:user"><div data-user-message-bubble="true"></div></div>`;
      if(id!=='pending-chatgpt-submit')turn.firstChild.setAttribute('data-chatgpt-search-message-ids',id);
      turn.querySelector('[data-user-message-bubble]').textContent=text;v.turns.append(turn);return turn;
    };
    v.message=(text,id=w.crypto.randomUUID())=>v.turn(text,id).querySelector('[data-user-message-bubble]');
    // A send first renders under a placeholder key, then remounts under the message id.
    v.sent=(text,id=w.crypto.randomUUID())=>{v.input.textContent='';const pending=v.turn(text,'pending-chatgpt-submit');return {pending,confirm(){pending.remove();return v.message(text,id);}};};
    v.stopping=()=>{v.send.type='button';v.send.setAttribute('aria-label','停止');};
    activate(v,active);
    return v;
  }
  function activate(v,active=true){
    if(active)for(const other of shell.children)if(other!==v.root){other.dataset.appShellActivePage='false';other.firstChild.style.display='none';}
    v.root.dataset.appShellActivePage=String(active);v.root.firstChild.style.display=active?'':'none';
  }
  // The home page stays mounted, hidden, once a thread is open.
  const home=view('home','中',atHome), current=atHome?home:view('thread',label,true);
  return {...page,...current,home,view,activate};
}
module.exports={makePage,makeShellPage,source,root,clone,settle};
