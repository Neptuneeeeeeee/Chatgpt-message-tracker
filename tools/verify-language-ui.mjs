import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Run against the actual installed extension and its storage, using only an isolated test profile.
export async function verifyLanguageUI({id,page,popup,cdp,evaluate,target,until,entries,directory}) {
  const options = await target(`chrome-extension://${id}/src/options.html`);
  await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false},options);
  await until(()=>evaluate(options,"document.querySelectorAll('#ui-language option').length===21"),'language settings initialization');
  const startup = await evaluate(options,"({ui:document.querySelector('#ui-language').value,mode:document.querySelector('#mode-label-language').value,lang:document.documentElement.lang})");
  assert.deepEqual(startup,{ui:'en-US',mode:'en-US',lang:'en-US'});
  const choices = await evaluate(options,"ChatGPTTrackerI18n.LANGUAGES.map(row=>row[0])");
  const results = [{case:'English default on real extension settings',pass:true}];
  let addedRecords = 0;
  for(let index=0;index<choices.length;index++) {
    const ui=choices[index], mode=choices[(index+5)%choices.length];
    const before=await entries();
    await evaluate(options,`(()=>{for(const [key,value] of [['ui-language',${JSON.stringify(ui)}],['mode-label-language',${JSON.stringify(mode)}]]){const select=document.getElementById(key);select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
    await until(()=>evaluate(options,`chrome.storage.local.get('cmt.settings').then(data=>data['cmt.settings'].uiLanguage===${JSON.stringify(ui)}&&data['cmt.settings'].modeLabelLanguage===${JSON.stringify(mode)})`),'persist language pair '+ui);
    await until(()=>evaluate(popup,`document.documentElement.lang===${JSON.stringify(ui)} && document.querySelector('#open-options').textContent===ChatGPTTrackerUILocales[${JSON.stringify(ui)}].settings && document.querySelector('#active-mode option[value="high"]').textContent===ChatGPTTrackerSiteLocales[${JSON.stringify(mode)}].modes.high[0]`),'popup language pair '+ui);
    const highLabel=await evaluate(options,`ChatGPTTrackerSiteLocales[${JSON.stringify(mode)}].modes.high[0]`);
    await until(()=>evaluate(page,`document.querySelector('#cmt-widget')?.lang===${JSON.stringify(ui)} && document.querySelector('#cmt-mode-select option[value="high"]').textContent===${JSON.stringify(highLabel)}`),'widget language pair '+ui);
    assert.deepEqual(await entries(),before,'display preferences never modify history');
    const status=await evaluate(options,"({dir:document.documentElement.dir,overflow:document.documentElement.scrollWidth>innerWidth+1,inputs:document.querySelectorAll('#mode-list input[data-field=label]').length})");
    assert.equal(status.dir,ui==='ar'?'rtl':'ltr');assert.equal(status.overflow,false,ui+' options overflow');assert.equal(status.inputs,5);
    await evaluate(page,`window.fixture.hold=false;document.documentElement.lang='zh-CN';document.querySelector('#mode').textContent='高';document.querySelector('#composer-submit-button').dataset.testid='send-button';document.querySelector('#composer-submit-button').setAttribute('aria-label','发送提示词');document.querySelector('#prompt-textarea').textContent=${JSON.stringify('language-pair-'+index)};document.querySelector('#composer-submit-button').click()`);
    await until(async()=> (await entries()).length===before.length+1,'mixed-language send '+ui);
    assert.equal((await entries()).at(-1).modeId,'high');
    assert.equal(await evaluate(page,"document.documentElement.lang"),'zh-CN','widget must not alter host language');
    addedRecords++;
    results.push({case:'Independent UI, option labels, page detection and count',uiLanguage:ui,modeLabelLanguage:mode,pageLanguage:'zh-CN',pass:true});
    if(['en-US','zh-CN','ar','hi-IN','de-DE'].includes(ui)) {
      const screenshot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},options);
      fs.writeFileSync(path.join(directory,'settings-'+ui+'.png'),Buffer.from(screenshot.data,'base64'));
    }
  }
  await evaluate(options,"(()=>{for(const id of ['ui-language','mode-label-language']){const select=document.getElementById(id);select.value='en-US';select.dispatchEvent(new Event('change',{bubbles:true}));}})()");
  await until(()=>evaluate(popup,"document.documentElement.lang==='en-US' && document.querySelector('#active-mode option[value=high]').textContent==='High'"),'restore default English');
  const fresh=await target(`chrome-extension://${id}/src/options.html`);
  await until(()=>evaluate(fresh,"document.querySelector('#mode-label-language')?.value==='en-US' && document.querySelector('#ui-language')?.value==='en-US'"),'reopen persisted settings');
  results.push({case:'Preferences retained after reopening settings',pass:true});
  const baseline=await entries();
  await evaluate(popup,"document.querySelector('#more-panel').open=true;document.querySelector('#manual-add').click()");
  await until(async()=> (await entries()).length===baseline.length+1,'localized popup add');
  await evaluate(popup,"document.querySelector('#undo').click()");
  await until(async()=> (await entries()).length===baseline.length,'localized popup undo');
  assert.deepEqual(await entries(),baseline);
  results.push({case:'Localized popup manual add and undo retain records',pass:true});
  await evaluate(popup,"document.querySelector('#more-panel').open=false");
  return {results,addedRecords,languagePairs:choices.length};
}
