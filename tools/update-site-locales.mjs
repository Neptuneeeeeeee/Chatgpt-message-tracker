// Rebuild the small bundled lexicon from ChatGPT's OWN published locale resources.
// Developer-only. The extension itself never fetches a locale, executes remote code, or uploads data.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {extractLabels} from './extract-official-labels.mjs';
const loaderURL='https://chatgpt.com/cdn/assets/70025534-ljy4z66laldz1yhs.js';
const cache=process.argv[2]||'/tmp/cmt-official-assets';
const requested=(process.argv[3]||'zh-CN,zh-TW,zh-HK,es-ES,es-419,pt-BR,pt-PT,fr-FR,fr-CA,de-DE,ja-JP,ko-KR,ar,hi-IN,ru-RU,id-ID,it-IT,tr-TR,vi-VN,th-TH').split(',');
const root=path.resolve(import.meta.dirname,'..');
fs.mkdirSync(cache,{recursive:true});
function download(url,destination){
 const temp=destination+'.part';
 const r=spawnSync('curl',['--compressed','--fail','--silent','--show-error','--max-time','60','--retry','1','--retry-delay','1',url,'-o',temp],{encoding:'utf8',timeout:130000});
 if(r.status!==0)throw new Error(`Download failed: ${url}: ${r.error?.message||r.stderr}`);
 fs.renameSync(temp,destination);
}
const loaderFile=path.join(cache,'locale-loader.js');
if(!fs.existsSync(loaderFile))download(loaderURL,loaderFile);
const loader=fs.readFileSync(loaderFile,'utf8');
const files=new Map([...loader.matchAll(/"\.\/locales\/([^"/]+)\.json"[^\n]*?import\(`\.\/([^`/]+\.js)`\)/g)].map(m=>[m[1],m[2]]));
const keys={instant:['voiceFloatingOrbSettingsModal.intelligence.option.instant'],medium:['voiceFloatingOrbSettingsModal.intelligence.option.medium'],high:['voiceFloatingOrbSettingsModal.intelligence.option.high'],'extra-high':['EDAyEb','0NW3sS'],pro:['chatgpt.composer.intelligence_picker.pro_effort.pill.label.standard','chatgpt.composer.intelligence_picker.pro_effort.pill.label.extended']};
const sendKeys=['xfIykB','PromptTextarea.sendMessageTooltip'];
const stopKeys=['FT0eIf','PromptTextarea.stopGenerating'];
const pickerKeys=['chatgpt.composer.model_picker.trigger.open.placeholder','chatgpt.composer.model_picker.trigger.open.placeholder.effort','chatgpt.composer.intelligence_picker.thinking_effort.tooltip'];
const selectedKeys=[...Object.values(keys).flat(),...sendKeys,...stopKeys,...pickerKeys];
const english={'voiceFloatingOrbSettingsModal.intelligence.option.instant':'Instant','voiceFloatingOrbSettingsModal.intelligence.option.medium':'Medium','voiceFloatingOrbSettingsModal.intelligence.option.high':'High',EDAyEb:'Extra High','0NW3sS':'Extra high thinking','chatgpt.composer.intelligence_picker.pro_effort.pill.label.standard':'Pro','chatgpt.composer.intelligence_picker.pro_effort.pill.label.extended':'Pro Extended',xfIykB:'Send prompt','PromptTextarea.sendMessageTooltip':'Send message',FT0eIf:'Stop answering','PromptTextarea.stopGenerating':'Stop generating','chatgpt.composer.model_picker.trigger.open.placeholder':'Select model','chatgpt.composer.model_picker.trigger.open.placeholder.effort':'Select effort','chatgpt.composer.intelligence_picker.thinking_effort.tooltip':'Thinking effort'};
function compact(messages){
 const values=ids=>[...new Set(ids.map(id=>messages[id]).filter(Boolean))];
 return {modes:Object.fromEntries(Object.entries(keys).map(([mode,ids])=>[mode,values(ids)])),send:values(sendKeys),stop:values(stopKeys),picker:values(pickerKeys)};
}
const output={'en-US':compact(english)};
const evidence={loaderURL,loaderSHA256:crypto.createHash('sha256').update(loader).digest('hex'),messageKeys:keys,note:'instant/medium/high keys are official voice-settings intelligence labels; text composer presets may have server-provided overrides. These are conservative exact-label fallbacks, NOT proof every account renders these labels. No Light/Standard/Extended/Heavy equivalence is inferred.',locales:{'en-US':{source:'defaultMessage descriptors in the official web bundles',messages:english}}};
const progress=path.join(cache,'locale-update-progress.json');
for(const locale of requested){
 const filename=files.get(locale); if(!filename)throw new Error(`Locale absent from official loader: ${locale}`);
 const file=path.join(cache,locale+'.js');
 const url=new URL(filename,loaderURL).href;
 if(!fs.existsSync(file))download(url,file);
 let source=fs.readFileSync(file,'utf8'),labels;
 try{labels=extractLabels(source);}catch{download(url,file);source=fs.readFileSync(file,'utf8');labels=extractLabels(source);}
 const messages=Object.fromEntries(selectedKeys.filter(k=>labels[k]).map(k=>[k,labels[k]]));
 const row=compact(messages);
 if(Object.values(row.modes).some(a=>!a.length)||!row.send.length||!row.stop.length)throw new Error(`Incomplete official label set for ${locale}; refusing to invent translations`);
 output[locale]=row;
 evidence.locales[locale]={url,sha256:crypto.createHash('sha256').update(source).digest('hex'),messages};
 fs.writeFileSync(progress,JSON.stringify({completed:Object.keys(output),latest:locale},null,2));
 console.log(locale,JSON.stringify(row.modes));
}
fs.mkdirSync(path.join(root,'docs'),{recursive:true});
fs.writeFileSync(path.join(root,'docs/site-language-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
fs.writeFileSync(path.join(root,'src/site-locales.js'),'// Generated from official ChatGPT UI resources. See docs/site-language-evidence.json.\n(function (root) {\n  "use strict";\n  root.ChatGPTTrackerSiteLocales = '+JSON.stringify(output,null,2)+';\n})(typeof window !== "undefined" ? window : globalThis);\n');
console.log('GENERATED',Object.keys(output).length,'locale variants');
