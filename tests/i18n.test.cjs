const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {makePage, source, clone, settle} = require('./helpers.cjs');
const ctx={window:{}};vm.createContext(ctx);
for(const file of ['shared.js','site-locales.js','ui-locales.js','i18n.js']) vm.runInContext(source('src/'+file),ctx);
const Core=ctx.window.ChatGPTTrackerCore, I=ctx.window.ChatGPTTrackerI18n;
const ui=ctx.window.ChatGPTTrackerUILocales, site=ctx.window.ChatGPTTrackerSiteLocales;
const langs=Array.from(Core.SUPPORTED_LANGUAGES);
const keys=Object.keys(ui['en-US']).sort();
const placeholders=s=>Array.from(s.matchAll(/\{(\w+)\}/g),m=>m[1]).sort();
const wait=async fn=>{for(let i=0;i<150;i++){if(fn())return;await settle(10);}assert.fail('UI did not settle');};
async function screen(kind, settings={}) {
  const p=makePage({settings});
  const parsed=new p.w.DOMParser().parseFromString(source('src/'+kind+'.html'),'text/html');
  p.document.head.innerHTML=parsed.head.innerHTML;
  p.document.body.innerHTML=parsed.body.innerHTML;
  p.document.documentElement.lang='en-US';p.document.documentElement.dir='ltr';
  p.w.confirm=()=>false;p.w.chrome.runtime.openOptionsPage=()=>Promise.resolve();p.w.chrome.tabs={create:()=>Promise.resolve()};
  p.w.eval(source('src/'+kind+'.js'));
  await wait(()=>p.document.querySelector(kind==='options'?'#ui-language option':'#active-mode option'));
  p.change=async(id,value)=>{const el=p.document.getElementById(id);el.value=value;el.dispatchEvent(new p.w.Event('change',{bubbles:true}));await settle(60);};
  return p;
}

test('both new and pre-language installations start in English without erasing records or settings',()=>{
  for(const input of [undefined,{activeModeId:'high',resetAt:123,modes:[{id:'high',label:'My research',enabled:true}]}]){
    const s=Core.normalizeSettings(input);assert.equal(s.uiLanguage,'en-US');assert.equal(s.modeLabelLanguage,'en-US');
    if(input){assert.equal(s.activeModeId,input.activeModeId);assert.equal(s.resetAt,123);assert.equal(s.modes[0].label,'My research');}
  }
  for(const value of ['auto','xx','__proto__',null,4]){const s=Core.normalizeSettings({uiLanguage:value,modeLabelLanguage:value});assert.equal(s.uiLanguage,'en-US');assert.equal(s.modeLabelLanguage,'en-US');}
});
test('UI, settings selector and original site vocabulary have the same 21 locales',()=>{
  assert.equal(langs.length,21);assert.deepEqual(Object.keys(ui).sort(),langs.slice().sort());assert.deepEqual(Object.keys(site).sort(),langs.slice().sort());
  assert.deepEqual(Array.from(I.LANGUAGES,l=>l[0]).sort(),langs.slice().sort());
});
for(const locale of langs){
  test(`${locale}: every UI key and placeholder is translated`,()=>{
    assert.deepEqual(Object.keys(ui[locale]).sort(),keys);
    for(const key of keys){assert.equal(typeof ui[locale][key],'string');assert.ok(ui[locale][key].trim());assert.deepEqual(placeholders(ui[locale][key]),placeholders(ui['en-US'][key]),key);}
    assert.ok(I.date('2026-09-17',{uiLanguage:locale}));assert.ok(I.number(1200,{uiLanguage:locale}));
  });
  test(`${locale}: popup and options render the selected language`,async t=>{
    const options=await screen('options',{uiLanguage:locale,modeLabelLanguage:'en-US'});t.after(options.close);
    assert.equal(options.document.documentElement.lang,locale);assert.equal(options.document.documentElement.dir,locale==='ar'?'rtl':'ltr');
    assert.equal(options.document.querySelector('[data-i18n="uiLanguage"]').textContent,ui[locale].uiLanguage);
    assert.equal(options.document.querySelectorAll('#mode-label-language option').length,21);
    assert.equal(options.document.querySelector('#mode-name-2').value,'High');
    const popup=await screen('popup',{uiLanguage:locale,modeLabelLanguage:'zh-CN'});t.after(popup.close);
    assert.equal(popup.document.querySelector('#open-options').textContent,ui[locale].settings);
    assert.equal(popup.document.querySelector('#active-mode option[value="high"]').textContent,'高');
    assert.equal(popup.document.querySelector('#window-range option[value="7d"]').textContent,ui[locale].window7d);
    assert.deepEqual(options.errors,[]);assert.deepEqual(popup.errors,[]);
  });
  test(`${locale}: widget display cannot overwrite actual page language or change count attribution`,async t=>{
    const p=makePage({lang:'zh-CN',label:'极高',settings:{showWidget:true,uiLanguage:locale,modeLabelLanguage:locale}});t.after(p.close);await p.start();
    const root=p.document.querySelector('#cmt-widget');assert.equal(root.lang,locale);assert.equal(p.document.documentElement.lang,'zh-CN');
    assert.equal(p.document.querySelector('#cmt-mode-select option[value="extra-high"]').textContent,site[locale].modes['extra-high'][0]);
    p.draft('same page different display '+locale);p.key();p.input.textContent='';p.message('same page different display '+locale);await settle();
    assert.equal(p.values['cmt.usage'].entries.length,1);assert.equal(p.values['cmt.usage'].entries[0].modeId,'extra-high');
  });
}
test('all 441 interface/mode-label combinations stay independent with the original five IDs',()=>{
  const modes=Core.DEFAULT_SETTINGS.modes;
  for(const a of langs)for(const b of langs){const settings={uiLanguage:a,modeLabelLanguage:b};assert.equal(I.t('settings',settings),ui[a].settings);for(const mode of modes)assert.equal(I.modeLabel(mode,settings),site[b].modes[mode.id][0]);}
});
test('language changes persist, retain edits and never save translated built-in names',async t=>{
  const p=await screen('options');t.after(p.close);
  const old=clone(p.values['cmt.usage']);
  await p.change('mode-label-language','zh-CN');assert.equal(p.document.querySelector('#mode-name-2').value,'高');
  assert.equal(p.values['cmt.settings'].uiLanguage,'en-US');assert.equal(p.values['cmt.settings'].modeLabelLanguage,'zh-CN');
  p.document.getElementById('save').click();await settle(80);assert.equal(p.values['cmt.settings'].modes[2].label,'High');
  const input=p.document.querySelector('#mode-name-2');input.value='Private research';input.dispatchEvent(new p.w.Event('input',{bubbles:true}));
  await p.change('ui-language','ja-JP');assert.equal(p.document.querySelector('#mode-name-2').value,'Private research');
  assert.equal(p.values['cmt.settings'].modes[2].label,'High');
  p.document.getElementById('save').click();await settle(80);
  await p.change('mode-label-language','ar');assert.equal(p.document.querySelector('#mode-name-2').value,'Private research');
  assert.equal(p.values['cmt.settings'].modes[2].label,'Private research');assert.deepEqual(p.values['cmt.usage'],old);
  const reopened=await screen('options',p.values['cmt.settings']);t.after(reopened.close);
  assert.equal(reopened.document.documentElement.lang,'ja-JP');assert.equal(reopened.document.querySelector('#mode-label-language').value,'ar');
});
test('rapid language selections keep the last selected values and no stale mode patch resets them',async t=>{
  const p=await screen('options');t.after(p.close);
  for(const [id,value] of [['ui-language','zh-CN'],['mode-label-language','ja-JP'],['ui-language','ar']]){
    const el=p.document.getElementById(id);el.value=value;el.dispatchEvent(new p.w.Event('change',{bubbles:true}));
  }
  await settle(200);await p.w.ChatGPTTrackerCore.patchSettings({activeModeId:'high'});
  assert.equal(p.values['cmt.settings'].uiLanguage,'ar');assert.equal(p.values['cmt.settings'].modeLabelLanguage,'ja-JP');
});
test('custom labels and interpolation are rendered as text, never executable markup',async t=>{
  const p=await screen('options',{modes:[{id:'high',label:'<img src=x onerror=alert(1)>',enabled:true}]});t.after(p.close);
  assert.equal(p.document.querySelector('#mode-list img'),null);assert.match(p.document.querySelector('#mode-name-0').value,/<img/);
  for(const locale of langs)assert.equal(I.modeLabel({id:'high',label:'User name'},{modeLabelLanguage:locale}),'User name');
});
