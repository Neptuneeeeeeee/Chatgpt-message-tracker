// ChatGPT's 2026-09 app shell: the DOM and the send sequence recorded from a live account.
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeShellPage,settle}=require('./helpers.cjs');
const count=p=>p.values['cmt.usage'].entries.length;

test('composer, picker and send button are taken from the active page, not a hidden one',t=>{
 const p=makeShellPage({label:'Pro'});t.after(p.close);
 assert.equal(p.detector.composer(),p.input);
 assert.equal(p.detector.detect(p.modes).mode.id,'pro');
 assert.equal(p.detector.isSendButton(p.send.querySelector('path')),true);
 assert.equal(p.detector.isSendButton(p.home.send),false);
 p.activate(p.home);
 assert.equal(p.detector.composer(),p.home.input);assert.equal(p.detector.detect(p.modes).mode.id,'medium');
});
test('a page without a composer has none, even while hidden pages keep theirs',t=>{
 const p=makeShellPage();t.after(p.close);
 p.root.dataset.appShellActivePage='false';
 assert.equal(p.detector.composer(),null);assert.equal(p.detector.sendButtonReady(),false);
});
test('the placeholder label shown while the picker is open is not a mode',t=>{
 const p=makeShellPage();t.after(p.close);
 p.mode.textContent='思考强度';assert.equal(p.detector.detect(p.modes).mode,null);
});
test('Enter counts once across the placeholder turn and its remount under the message id',async t=>{
 const p=makeShellPage({label:'极高'});t.after(p.close);p.message('已有记录');await p.start();
 p.draft('新界面发送');p.key();const sent=p.sent('新界面发送');await settle();
 assert.equal(count(p),1);assert.equal(p.values['cmt.usage'].entries[0].modeId,'extra-high');
 sent.confirm();await settle();assert.equal(count(p),1);
 assert.deepEqual(p.errors,[]);
});
test('every send shares one placeholder key, and each is still counted',async t=>{
 const p=makeShellPage();t.after(p.close);await p.start();
 for(const text of ['第一条','第二条','第二条']){p.draft(text);p.key();const sent=p.sent(text);await settle();sent.confirm();await settle();}
 assert.equal(count(p),3);
});
test('a send that skips the placeholder and appears under its id counts too',async t=>{
 const p=makeShellPage();t.after(p.close);await p.start();
 p.draft('直接出现');p.key();p.input.textContent='';p.message('直接出现');await settle();assert.equal(count(p),1);
});
test('clicking the unlabelled submit button counts; the stop button in its place does not',async t=>{
 const p=makeShellPage();t.after(p.close);await p.start();
 p.send.removeAttribute('aria-label');
 p.draft('点击发送');p.send.querySelector('path').dispatchEvent(new p.w.MouseEvent('click',{bubbles:true}));p.sent('点击发送').confirm();await settle();
 assert.equal(count(p),1);
 p.stopping();assert.equal(p.detector.isSendButton(p.send),false);assert.equal(p.detector.sendButtonReady(),false);
 p.send.click();p.key();await settle();assert.equal(count(p),1);
 p.send.removeAttribute('aria-label');assert.equal(p.detector.isSendButton(p.send),false);
});
test('the inline edit-message editor is not the composer',async t=>{
 const p=makeShellPage();t.after(p.close);const bubble=p.message('原来的消息','11111111-2222-4333-8444-555555555555');await p.start();
 const turn=bubble.closest('[data-turn-key]'),unit=bubble.parentElement;bubble.remove();
 unit.insertAdjacentHTML('beforeend','<form><div contenteditable="true" data-composer-markdown>原来的消息</div><button type="button">取消</button><button type="submit">发送</button></form>');
 const editor=unit.querySelector('[data-composer-markdown]');
 assert.equal(p.detector.composer(),p.input);assert.equal(p.detector.isSendButton(unit.querySelector('[type="submit"]')),false);
 editor.dispatchEvent(new p.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 unit.querySelector('form').remove();turn.remove();p.message('原来的消息','11111111-2222-4333-8444-555555555555');await settle();
 assert.equal(count(p),0);
});
test('a turn unmounted by virtual scrolling and mounted again is not a send',async t=>{
 const p=makeShellPage();t.after(p.close);const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';const bubble=p.message('继续',id);await p.start();
 p.draft('继续');p.input.textContent='';bubble.closest('[data-turn-key]').remove();p.message('继续',id);await settle();
 assert.equal(count(p),0);
});
test('a matching message in a hidden page cannot confirm a send',async t=>{
 const p=makeShellPage();t.after(p.close);await p.start();
 p.draft('只在当前页');p.key();p.input.textContent='';p.home.message('只在当前页');await settle();assert.equal(count(p),0);
 p.message('只在当前页');await settle();assert.equal(count(p),1);
});
test('the newest message is judged within its own page',async t=>{
 const p=makeShellPage();t.after(p.close);
 // Mounted after the active page, so its turns come later in document order.
 const other=p.view('thread','Pro',false);other.message('别的会话');await p.start();
 p.draft('当前会话');p.key();p.sent('当前会话').confirm();await settle();assert.equal(count(p),1);
 p.activate(other);await settle();p.activate(p);await settle();assert.equal(count(p),1);
});
test('the first send from the home page counts when its thread page is mounted',async t=>{
 const p=makeShellPage({atHome:true});t.after(p.close);await p.start();
 assert.equal(p.detector.composer(),p.input);
 p.draft('新会话');p.key();p.input.textContent='';
 const thread=p.view('thread','中',true);p.w.history.pushState({},'','/c/local-chatgpt-1');thread.message('新会话');await settle();
 assert.equal(count(p),1);assert.equal(p.values['cmt.usage'].entries[0].modeId,'medium');
 p.w.history.replaceState({},'','/c/real-id');await settle();assert.equal(count(p),1);
});
// The pill text is served per account; this is what a live account showed on 2026-09-30.
const observed={'en-US':['Instant','Medium','High','Extra High'],'zh-CN':['即时','中','高','极高'],'zh-TW':['即時','中','高','極高'],'zh-HK':['即時','中','高','極高'],'es-ES':['Instantánea','Media','Alta','Muy alta'],'es-419':['Instantánea','Media','Alta','Muy alta'],'pt-BR':['Instantânea','Média','Alta','Extra alto'],'pt-PT':['Instantâneo','Médio','Elevada','Muito elevado'],'fr-FR':['Instantané','Moyen','Élevée','Très élevé'],'fr-CA':['Instantané','Moyen','Élevé','Très élevé'],'de-DE':['Sofort','Mittel','Hoch','Sehr hoch'],'ja-JP':['Instant','中程度','高','極高'],'ko-KR':['Instant','Medium','High','Extra High'],ar:['فوري','متوسط','عالٍ','عالٍ جدًا'],'hi-IN':['इंस्टेंट','मध्यम','हाई','एक्स्ट्रा हाई'],'ru-RU':['Instant','Средний','Высокий','Очень высокий'],'id-ID':['Instant','Sedang','Tinggi','Ekstra Tinggi'],'it-IT':['Immediato','Medio','Alto','Molto alto'],'tr-TR':['Hızlı','Orta','Yüksek','Çok Yüksek'],'vi-VN':['Tức thì','Vừa','Cao','Chuyên sâu'],'th-TH':['Instant','Medium','High','Extra High']};
for(const [lang,labels] of Object.entries(observed))test(`${lang}: level labels shown by the live picker resolve to their modes`,t=>{
 const p=makeShellPage({lang});t.after(p.close);
 [...labels,'Pro'].forEach((label,index)=>{p.mode.textContent=label;assert.equal(p.detector.detect(p.modes).mode?.id,p.modes[index].id,label);});
});
