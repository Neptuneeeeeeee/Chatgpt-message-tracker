const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {makePage,source,clone}=require('./helpers.cjs');
const context={};vm.createContext(context);vm.runInContext(source('src/site-locales.js'),context);
const locales=clone(context.ChatGPTTrackerSiteLocales);
const evidence=JSON.parse(source('docs/site-language-evidence.json'));
for(const [lang,row] of Object.entries(locales)) {
  for(const [id,labels] of Object.entries(row.modes)) test(`${lang}: official ${id} labels resolve to the existing ID`,t=>{
    const p=makePage({lang});t.after(p.close);
    for(const label of labels){p.mode.textContent=label;assert.equal(p.detector.detect(p.modes).mode?.id,id,label);}
  });
  test(`${lang}: send and stop use native labels, with stop taking priority`,t=>{
    const p=makePage({lang});t.after(p.close);
    p.send.removeAttribute('data-testid');p.send.type='submit';
    for(const label of row.send){p.send.setAttribute('aria-label',label);assert.equal(p.detector.isSendButton(p.send),true,label);}
    for(const label of row.stop){p.send.setAttribute('data-testid','send-button');p.send.setAttribute('aria-label',label);assert.equal(p.detector.isSendButton(p.send),false,label);}
  });
  test(`${lang}: bundled aliases are traceable to extracted original source keys`,()=>{
    const original=evidence.locales[lang];assert.ok(original);
    if(lang!=='en-US'){assert.match(original.url,/^https:\/\/chatgpt\.com\/cdn\/assets\/[a-z0-9-]+\.js$/);assert.match(original.sha256,/^[a-f0-9]{64}$/);}
    for(const [mode,aliases] of Object.entries(row.modes)){
      assert.deepEqual(aliases,[...new Set(evidence.messageKeys[mode].map(key=>original.messages[key]).filter(Boolean))]);
    }
  });
}
test('page language overrides browser language, changing lang immediately changes recognition',t=>{
 const p=makePage({lang:'zh-CN',label:'极高'});t.after(p.close);
 Object.defineProperty(p.w.navigator,'language',{value:'en-US'});
 assert.equal(p.detector.detect(p.modes).mode.id,'extra-high');
 p.document.documentElement.lang='ja-JP';p.mode.textContent='高い';assert.equal(p.detector.detect(p.modes).mode.id,'high');
 p.document.documentElement.lang='en-US';assert.equal(p.detector.detect(p.modes).mode,null);
 p.mode.textContent='High';assert.equal(p.detector.detect(p.modes).mode.id,'high');
});
test('locale normalization preserves script and regional distinctions',t=>{
 const p=makePage();t.after(p.close);const resolve=p.w.ChatGPTTrackerSiteDetection.resolveLocale;
 for(const [input,expected] of [['zh-Hans','zh-CN'],['zh_Hant','zh-TW'],['zh-Hant-HK','zh-HK'],['pt-PT','pt-PT'],['fr-CA','fr-CA'],['es-MX','es-419'],['pt-AO','pt-PT'],['ja','ja-JP'],['xx-YY',null]])assert.equal(resolve(input),expected,input);
});
test('no Chinese substring matches or guessed English-level equivalences',t=>{
 const p=makePage();t.after(p.close);
 for(const label of ['提高','正在处理中','高中','极高难度','选择高质量','Medium rare','Standard','Extended','Light','Heavy','High resolution']){
   p.mode.textContent=label;assert.equal(p.detector.detect(p.modes).mode,null,label);
 }
 p.mode.textContent='极高';assert.equal(p.detector.detect(p.modes).mode.id,'extra-high');
});
test('normalizes full-width digits, NBSP, split labels and RTL marks',t=>{
 const p=makePage({lang:'en-US'});t.after(p.close);
 for(const [html,id] of [['６Pro','pro'],['GPT-6.1Pro','pro'],['<span>6</span><span>Pro</span>','pro'],['<span>Extra</span><span>High</span>','extra-high'],['Extra\u00a0High','extra-high']]){
   p.mode.innerHTML=html;assert.equal(p.detector.detect(p.modes).mode?.id,id,html);
 }
 p.document.documentElement.lang='ar';p.mode.textContent='\u2067'+locales.ar.modes.high[0]+'\u2069';assert.equal(p.detector.detect(p.modes).mode.id,'high');
});
test('renaming a mode does not destroy native-language recognition; disabled modes stay disabled',t=>{
 const p=makePage();t.after(p.close);p.modes.find(m=>m.id==='high').label='个人研究';
 assert.equal(p.detector.detect(p.modes).mode.id,'high');
 p.modes.find(m=>m.id==='high').enabled=false;assert.equal(p.detector.detect(p.modes).mode,null);
});
test('ambiguous custom labels do not silently win',t=>{
 const p=makePage();t.after(p.close);p.modes.push({id:'custom-a',label:'高',enabled:true});assert.equal(p.detector.detect(p.modes).mode,null);
});
test('unrelated selected menus, transcript, file and tracker UI cannot change mode',t=>{
 const p=makePage();t.after(p.close);
 p.document.body.insertAdjacentHTML('beforeend','<div role="menu"><button role="menuitemradio" aria-checked="true">Pro</button></div><div id="cmt-widget"><button data-testid="model-switcher">Pro</button></div><div data-message-author-role="assistant"><button data-testid="model-switcher">Pro</button></div>');
 p.input.parentElement.insertAdjacentHTML('beforeend','<div data-testid="attachment"><button aria-haspopup="menu">Pro</button></div>');
 assert.equal(p.detector.detect(p.modes).mode.id,'high');
});
test('only the checked item in a picker-owned portal overrides the composer',t=>{
 const p=makePage();t.after(p.close);p.mode.setAttribute('aria-controls','picker');
 p.document.body.insertAdjacentHTML('beforeend','<div id="picker" role="menu"><button role="menuitemradio" aria-checked="false">Pro</button><button role="menuitemradio" aria-checked="true"><span>极高</span><span>用于复杂任务</span></button></div>');
 const result=p.detector.detect(p.modes);assert.equal(result.mode.id,'extra-high');assert.equal(result.source,'selected-menu');
 p.document.getElementById('picker').hidden=true;assert.equal(p.detector.detect(p.modes).mode.id,'high');
});
test('official intelligence picker portal is scoped even without aria-controls',t=>{
 const p=makePage();t.after(p.close);
 p.document.body.insertAdjacentHTML('beforeend','<div data-testid="composer-intelligence-picker-content" role="group"><button data-state="checked"><span>中</span><span>其他描述</span></button></div>');
 assert.equal(p.detector.detect(p.modes).mode.id,'medium');
});
test('descriptions and hidden mode labels are not primary labels',t=>{
 const p=makePage();t.after(p.close);
 p.mode.innerHTML='<span>新模式</span><span>Pro</span>';assert.equal(p.detector.detect(p.modes).mode,null);
 p.mode.innerHTML='<span style="display:none">Pro</span><span>高</span>';assert.equal(p.detector.detect(p.modes).mode?.id,'high');
});
test('send requires a composer control, handles SVG targets, and excludes disabled or stop controls',t=>{
 const p=makePage();t.after(p.close);assert.equal(p.detector.isSendButton(p.send.querySelector('path')),true);
 p.send.disabled=true;assert.equal(p.detector.sendButtonReady(),false);p.send.disabled=false;
 p.send.setAttribute('data-testid','stop-button');assert.equal(p.detector.sendButtonReady(),false);
 p.send.removeAttribute('data-testid');p.send.removeAttribute('aria-label');p.send.type='submit';assert.equal(p.detector.isSendButton(p.send),false);
 p.document.body.insertAdjacentHTML('beforeend','<button id="outside" data-testid="send-button">Send</button>');assert.equal(p.detector.isSendButton(p.document.getElementById('outside')),false);
});
