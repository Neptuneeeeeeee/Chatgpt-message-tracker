const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const scripts = ['src/shared.js','src/site-locales.js','src/site-detection.js'];
const code = Object.fromEntries([...scripts, 'src/content.js'].map(file => [file, source(file)]));
const clone = value => JSON.parse(JSON.stringify(value));
const settle = async (ms=20) => { await new Promise(resolve => setTimeout(resolve, ms)); };
function makePage({lang='zh-CN', label='高', settings={}, entries=[]}={}) {
  const errors=[];
  const virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom=new JSDOM('<!doctype html><html><body><main><section id="messages"></section><form><div id="prompt-textarea" contenteditable="true"></div><button id="mode" type="button" aria-haspopup="menu"></button><button id="composer-submit-button" type="button" data-testid="send-button" aria-label="发送提示词"><svg><path></path></svg></button></form></main></body></html>',{url:'https://chatgpt.com/c/test',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
  const w=dom.window;
  w.document.documentElement.lang=lang;
  w.document.getElementById('mode').textContent=label;
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
  const input=w.document.getElementById('prompt-textarea');
  const mode=w.document.getElementById('mode');
  const send=w.document.getElementById('composer-submit-button');
  function draft(text){input.textContent=text;input.dispatchEvent(new w.Event('input',{bubbles:true}));}
  function key(options={}){input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...options}));}
  function message(text,id='msg-'+Math.random()){
    const node=w.document.createElement('div');node.dataset.messageAuthorRole='user';node.dataset.messageId=id;node.textContent=text;
    w.document.getElementById('messages').append(node);return node;
  }
  return {dom,w,document:w.document,values,errors,modes,detector,input,mode,send,draft,key,message,close:()=>dom.window.close(),async start(){w.eval(code['src/content.js']);await settle();},reload(){w.eval(code['src/content.js']);}};
}
module.exports={makePage,source,root,clone,settle};
