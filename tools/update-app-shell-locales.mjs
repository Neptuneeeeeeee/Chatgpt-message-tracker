// Add the labels of ChatGPT's 2026-09 app shell to the bundled lexicon, again from its OWN locale resources.
// That shell ships one plain JSON file per language, listed in a small map chunk, so nothing is parsed as code.
// Developer-only; run AFTER update-site-locales.mjs, which rewrites both outputs without these entries.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const mapURL=process.argv[3]||'https://chatgpt.com/cdn/assets/908190.314710993e.js';
const cache=process.argv[2]||'/tmp/cmt-official-assets/app-shell';
const root=path.resolve(import.meta.dirname,'..');
fs.mkdirSync(cache,{recursive:true});
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
function download(url,destination){
 if(fs.existsSync(destination))return;
 const temp=destination+'.part';
 const r=spawnSync('curl',['--compressed','--fail','--silent','--show-error','--max-time','120','--retry','1','--retry-delay','1',url,'-o',temp],{encoding:'utf8',timeout:260000});
 if(r.status!==0)throw new Error(`Download failed: ${url}: ${r.error?.message||r.stderr}`);
 fs.renameSync(temp,destination);
}
// Same selections as update-site-locales.mjs: the entries already in the lexicon.
const legacySendKeys=['xfIykB','PromptTextarea.sendMessageTooltip'];
const legacyStopKeys=['FT0eIf','PromptTextarea.stopGenerating'];
const legacyPickerKeys=['chatgpt.composer.model_picker.trigger.open.placeholder','chatgpt.composer.model_picker.trigger.open.placeholder.effort','chatgpt.composer.intelligence_picker.thinking_effort.tooltip'];
// The pill text itself is served per account; these are the shell's own names for the same levels.
const preview='chatgpt.plus_onboarding.carousel.page.intelligence.preview.option.';
const keys={instant:['voiceFloatingOrbSettingsModal.intelligence.instant',preview+'instant'],medium:['voiceFloatingOrbSettingsModal.intelligence.medium',preview+'medium'],high:['voiceFloatingOrbSettingsModal.intelligence.high',preview+'high'],'extra-high':[preview+'extra_high'],pro:[]};
const sendKeys=['chatgptConversations.composer.send.ariaLabel'];
const stopKeys=['chatgptConversations.composer.stop.ariaLabel'];
const pickerKeys=['chatgptConversations.modelPicker.ariaLabel','chatgptConversations.modelPicker.thinkingEffortTooltip'];
const selectedKeys=[...Object.values(keys).flat(),...sendKeys,...stopKeys,...pickerKeys];
// Only the defaults read from the bundle itself; the English level names are already in the lexicon.
const english={'chatgptConversations.composer.send.ariaLabel':'Send','chatgptConversations.composer.stop.ariaLabel':'Stop','chatgptConversations.modelPicker.ariaLabel':'Select ChatGPT model','chatgptConversations.modelPicker.thinkingEffortTooltip':'Thinking effort'};
const evidenceFile=path.join(root,'docs/site-language-evidence.json');
const evidence=JSON.parse(fs.readFileSync(evidenceFile,'utf8'));
const mapFile=path.join(cache,'locale-map.js');
download(mapURL,mapFile);
const map=fs.readFileSync(mapFile,'utf8');
const files=new Map([...map.matchAll(/"(assets\/([A-Za-z0-9-]+)\.[0-9a-f]+\.json)"/g)].map(m=>[m[2],m[1]]));
evidence.appShell={mapURL,mapSHA256:sha(map),messageKeys:keys,sendKeys,stopKeys,pickerKeys,note:'Plain JSON locale resources of the 2026-09 app shell. Its composer pill text is served per account and is not in these files; every level label a live account showed in the 21 variants on 2026-09-30 equals one of these entries, a legacy entry, or the en-US row.'};
for(const [locale,row] of Object.entries(evidence.locales)){
 if(locale==='en-US'){row.appShell={source:'defaultMessage descriptors in the official web bundles',messages:english};continue;}
 const name=files.get(locale); if(!name)throw new Error(`Locale absent from official map: ${locale}`);
 // The map lists paths relative to the bundler's public path, one level above the chunk itself.
 const url=new URL(name,new URL('..',mapURL)).href;
 const file=path.join(cache,locale+'.json');
 download(url,file);
 const source=fs.readFileSync(file,'utf8'),all=JSON.parse(source);
 const messages=Object.fromEntries(selectedKeys.filter(k=>typeof all[k]==='string'&&all[k]).map(k=>[k,all[k]]));
 if(sendKeys.concat(stopKeys).some(k=>!messages[k]))throw new Error(`Incomplete official label set for ${locale}; refusing to invent translations`);
 row.appShell={url,sha256:sha(source),messages};
}
const normalize=text=>String(text).normalize('NFKC').replace(/\s+/gu,' ').trim().toLowerCase();
const output={};
for(const [locale,row] of Object.entries(evidence.locales)){
 const messages={...row.messages,...row.appShell.messages};
 const values=ids=>[...new Set(ids.map(id=>messages[id]).filter(Boolean))];
 output[locale]={modes:Object.fromEntries(Object.keys(keys).map(mode=>[mode,values([...evidence.messageKeys[mode],...keys[mode]])])),send:values([...legacySendKeys,...sendKeys]),stop:values([...legacyStopKeys,...stopKeys]),picker:values([...legacyPickerKeys,...pickerKeys])};
}
for(const [locale,row] of Object.entries(output)){
 // An alias shared by two levels would make the detector refuse both; fail here instead.
 const owners=new Map();
 for(const source of [row,output['en-US']])for(const [mode,aliases] of Object.entries(source.modes))for(const alias of [mode,...aliases]){
  const key=normalize(alias);if(owners.has(key)&&owners.get(key)!==mode)throw new Error(`${locale}: "${alias}" names both ${owners.get(key)} and ${mode}`);
  owners.set(key,mode);
 }
 if(row.send.some(label=>row.stop.map(normalize).includes(normalize(label))))throw new Error(`${locale}: a send label is also a stop label`);
 console.log(locale,JSON.stringify(row.modes));
}
fs.writeFileSync(evidenceFile,JSON.stringify(evidence,null,2)+'\n');
fs.writeFileSync(path.join(root,'src/site-locales.js'),'// Generated from official ChatGPT UI resources. See docs/site-language-evidence.json.\n(function (root) {\n  "use strict";\n  root.ChatGPTTrackerSiteLocales = '+JSON.stringify(output,null,2)+';\n})(typeof window !== "undefined" ? window : globalThis);\n');
console.log('GENERATED',Object.keys(output).length,'locale variants');
