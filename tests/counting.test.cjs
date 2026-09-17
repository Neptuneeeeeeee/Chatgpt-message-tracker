const test=require('node:test');
const assert=require('node:assert/strict');
const {makePage,settle,source}=require('./helpers.cjs');
const evidence=JSON.parse(source('docs/site-language-evidence.json'));
for(const lang of Object.keys(evidence.locales)) test(`${lang}: actual content-script send path counts once under high`,async t=>{
 const label=evidence.locales[lang].messages['voiceFloatingOrbSettingsModal.intelligence.option.high'];
 const p=makePage({lang,label});t.after(p.close);await p.start();
 p.draft('测试 message '+lang);p.key();p.input.textContent='';const node=p.message('测试 message '+lang,'sent-1');await settle();
 assert.equal(p.values['cmt.usage'].entries.length,1);
 assert.equal(p.values['cmt.usage'].entries[0].modeId,'high');
 node.remove();p.message('测试 message '+lang,'sent-1');await settle();assert.equal(p.values['cmt.usage'].entries.length,1);
 assert.deepEqual(p.errors,[]);
});
for(const options of [{},{ctrlKey:true},{metaKey:true}])test(`Enter send variants ${JSON.stringify(options)} preserve the mode captured before sending`,async t=>{
 const p=makePage({label:'极高'});t.after(p.close);await p.start();p.draft('发送前选择');p.key(options);p.mode.textContent='Pro';p.input.textContent='';p.message('发送前选择');await settle();
 assert.equal(p.values['cmt.usage'].entries.length,1);assert.equal(p.values['cmt.usage'].entries[0].modeId,'extra-high');
});
for(const options of [{isComposing:true},{keyCode:229},{shiftKey:true}])test(`IME candidate / newline is not a send ${JSON.stringify(options)}`,async t=>{
 const p=makePage();t.after(p.close);await p.start();p.draft('正在选字');p.key(options);await settle(80);assert.equal(p.values['cmt.usage'].entries.length,0);
});
test('SVG send click and attachment-only send each produce one record',async t=>{
 const p=makePage();t.after(p.close);await p.start();
 p.send.querySelector('path').dispatchEvent(new p.w.MouseEvent('click',{bubbles:true}));p.message('attachment.pdf');await settle();assert.equal(p.values['cmt.usage'].entries.length,1);
 p.draft('第二条消息');p.send.querySelector('path').dispatchEvent(new p.w.MouseEvent('click',{bubbles:true}));p.input.textContent='';p.message('第二条消息');await settle();assert.equal(p.values['cmt.usage'].entries.length,2);
});
test('stop, draft editing and opening history do not count',async t=>{
 const p=makePage();t.after(p.close);p.message('已有记录','old');await p.start();
 p.send.dataset.testid='stop-button';p.send.setAttribute('aria-label','停止回答');p.send.click();
 p.draft('未发送草稿');p.input.textContent='';
 p.message('历史一','history-1');p.message('历史二','history-2');await settle();assert.equal(p.values['cmt.usage'].entries.length,0);
});
test('language changes keep the same ID and all existing history',async t=>{
 const old={id:'old',modeId:'high',ts:Date.now()-60000,source:'manual-popup'};
 const p=makePage({entries:[old]});t.after(p.close);await p.start();
 for(const [lang,label,text] of [['zh-CN','高','中文发送'],['en-US','High','English send'],['zh-TW','高','繁體發送']]){
  p.document.documentElement.lang=lang;p.mode.textContent=label;p.draft(text);p.key();p.input.textContent='';p.message(text);await settle();
 }
 const entries=p.values['cmt.usage'].entries;assert.equal(entries.length,4);assert.deepEqual(entries[0],old);assert.ok(entries.every(e=>e.modeId==='high'));
 assert.deepEqual(Object.keys(entries[1]).sort(),['id','modeId','source','ts']);
});
test('unknown labels use visible manual fallback, not a guessed mode',async t=>{
 const p=makePage({label:'未经证实的新标签',settings:{showWidget:true,activeModeId:'medium'}});t.after(p.close);await p.start();
 assert.match(p.document.querySelector('#cmt-mode-select').title,/未识别网页模式/);assert.match(p.document.querySelector('.cmt-sub').textContent,/手动模式/);
 p.draft('手动计数测试');p.key();p.input.textContent='';p.message('手动计数测试');await settle();assert.equal(p.values['cmt.usage'].entries[0].modeId,'medium');
});
test('manual-only mode remains authoritative even when the page says high',async t=>{
 const p=makePage({settings:{autoDetectMode:false,activeModeId:'pro'}});t.after(p.close);await p.start();p.draft('manual mode');p.key();p.input.textContent='';p.message('manual mode');await settle();assert.equal(p.values['cmt.usage'].entries[0].modeId,'pro');
});
test('extension reinjection takes over rather than double-counting',async t=>{
 const p=makePage();t.after(p.close);await p.start();p.reload();await settle();p.draft('one listener');p.key();p.input.textContent='';p.message('one listener');await settle();assert.equal(p.values['cmt.usage'].entries.length,1);
});
test('language and accessibility attribute changes refresh the detected mode',async t=>{
 const p=makePage({settings:{showWidget:true}});t.after(p.close);await p.start();
 p.mode.textContent='';p.mode.setAttribute('aria-label','Mittel');p.document.documentElement.lang='de-DE';
 await settle(1800);assert.equal(p.values['cmt.settings'].activeModeId,'medium');assert.match(p.document.querySelector('#cmt-mode-select').title,/de-DE/);
});
