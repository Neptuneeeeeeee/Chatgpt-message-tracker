const test = require('node:test');
const assert = require('node:assert/strict');
const {makePage, settle} = require('./helpers.cjs');

test('hidden-only labels must not identify a visible but empty trigger', t => {
  const p=makePage(); t.after(p.close);
  p.mode.innerHTML='<span style="display:none">Pro</span>';
  assert.equal(p.detector.detect(p.modes).mode,null);
});
test('unknown checked selection must not fall back to a stale known trigger', t => {
  const p=makePage(); t.after(p.close);
  p.mode.setAttribute('aria-controls','picker');
  p.document.body.insertAdjacentHTML('beforeend','<div id="picker" role="menu"><button role="menuitemradio" aria-checked="true">Unverified new level</button></div>');
  assert.equal(p.detector.detect(p.modes).mode,null);
});
test('checked radio controls inside an identified picker are recognized', t => {
  const p=makePage(); t.after(p.close);
  p.document.body.insertAdjacentHTML('beforeend','<div data-testid="composer-intelligence-picker-content"><button role="radio" aria-checked="true">极高</button></div>');
  assert.equal(p.detector.detect(p.modes).mode?.id,'extra-high');
});
test('disabled picker labels are not evidence of an active selection', t => {
  const p=makePage(); t.after(p.close); p.mode.disabled=true;
  assert.equal(p.detector.detect(p.modes).mode,null);
});
test('no language declaration is unknown, not an invented English page locale', t => {
  const p=makePage({lang:'',label:'High'}); t.after(p.close);
  const r=p.detector.detect(p.modes); assert.equal(r.locale,null); assert.equal(r.mode?.id,'high');
});
test('nested formatting preserves split Extra High without reducing it to High', t => {
  const p=makePage({lang:'en-US'}); t.after(p.close);
  p.mode.innerHTML='<span>Extra <b>High</b></span><span class="description">Longer reasoning</span>';
  assert.equal(p.detector.detect(p.modes).mode?.id,'extra-high');
});
test('distinct message IDs with identical text are two genuine sends', async t => {
  const p=makePage(); t.after(p.close); await p.start();
  for(const id of ['repeat-one','repeat-two']){
    p.draft('继续');p.key();p.input.textContent='';p.message('继续',id);await settle();
  }
  assert.equal(p.values['cmt.usage'].entries.length,2);
});
test('an unrelated new history message cannot confirm an outstanding send', async t => {
  const p=makePage(); t.after(p.close); await p.start();
  p.draft('未发送的新问题');p.key();p.input.textContent='';p.message('旧的历史问题','old-unrelated');await settle();
  assert.equal(p.values['cmt.usage'].entries.length,0);
});
test('conversation navigation cancels an intent even if historical text matches', async t => {
  const p=makePage(); t.after(p.close); await p.start();
  p.draft('继续');p.key();p.input.textContent='';
  p.w.history.pushState({},'', '/c/another');p.message('继续','history');await settle();
  assert.equal(p.values['cmt.usage'].entries.length,0);
});
test('typing in an unrelated textarea cannot create a composer send intent', async t => {
  const p=makePage(); t.after(p.close); await p.start();
  const other=p.document.createElement('textarea');p.document.body.append(other);other.value='其他设置';
  other.dispatchEvent(new p.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  p.message('其他设置','unrelated');await settle();
  assert.equal(p.values['cmt.usage'].entries.length,0);
});
test('a user-message shell populated in a later DOM update counts once', async t => {
  const p=makePage(); t.after(p.close); await p.start();
  p.draft('分步渲染的消息');p.key();p.input.textContent='';const node=p.message('','deferred');await settle();
  node.textContent='分步渲染的消息';await settle();assert.equal(p.values['cmt.usage'].entries.length,1);
  node.remove();p.message('分步渲染的消息','deferred');await settle();assert.equal(p.values['cmt.usage'].entries.length,1);
});
test('first send creating a new conversation URL still counts', async t => {
  const p=makePage(); t.after(p.close);p.w.history.replaceState({},'','/');await p.start();
  p.draft('新会话');p.key();p.input.textContent='';p.w.history.pushState({},'','/c/new');p.message('新会话');await settle();
  assert.equal(p.values['cmt.usage'].entries.length,1);
});
test('a slow confirmed render retains the pre-send mode past the first rescan', async t => {
  const p=makePage({label:'极高'});t.after(p.close);await p.start();
  p.draft('慢速确认');p.key();p.input.textContent='';p.mode.textContent='Pro';await settle(4200);
  assert.equal(p.values['cmt.usage'].entries.length,0);p.message('慢速确认');await settle();
  assert.equal(p.values['cmt.usage'].entries[0].modeId,'extra-high');
});
test('clearing or unmounting a draft without a new user message never counts', async t => {
  const p=makePage(); t.after(p.close); await p.start();
  p.draft('未确认发送');p.key();p.input.remove();await settle(4200);
  assert.equal(p.values['cmt.usage'].entries.length,0);
});
