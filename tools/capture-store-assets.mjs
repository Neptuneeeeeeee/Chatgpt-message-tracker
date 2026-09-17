// Capture actual extension controls with test-generated records. No personal profile or account.
// Screenshot 1 adds an explicitly labelled presentation frame; controls remain the real popup DOM.
import fs from 'node:fs';
import path from 'node:path';

export async function captureStoreAssets({directory, extensionId, cdp, evaluate, target}) {
  fs.mkdirSync(directory,{recursive:true});
  const metrics=async(session,width,height)=>cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
  const shot=async(session,name)=>{
    const data=await cdp('Page.captureScreenshot',{format:'jpeg',quality:94,fromSurface:true,captureBeyondViewport:false},session);
    fs.writeFileSync(path.join(directory,name),Buffer.from(data.data,'base64'));
  };
  const wait=async session=>{
    for(let i=0;i<120;i++){
      if(await evaluate(session,"!!window.ChatGPTTrackerCore && !!document.querySelector('select option, #mode-list input')"))return;
      await new Promise(r=>setTimeout(r,80));
    }
    throw new Error('Store screenshot page did not finish rendering');
  };
  const popup=await target(`chrome-extension://${extensionId}/src/popup.html`);
  await metrics(popup,1280,800);await wait(popup);
  await evaluate(popup,`(() => {
    const style=document.createElement('style');
    style.textContent='html{background:#edf3f1}body{width:1280px;min-height:800px;box-sizing:border-box;display:grid;grid-template-columns:560px 330px;justify-content:center;align-items:center;gap:100px;background:#edf3f1}.popup{grid-column:2;grid-row:1;width:330px;box-sizing:border-box;border:1px solid #d5dedb;border-radius:18px;background:#f6f7f9;box-shadow:0 22px 60px #163d2422}.store-copy{grid-column:1;grid-row:1;color:#172c27;font-family:system-ui,-apple-system,sans-serif}.store-copy h2{font-size:56px;line-height:1.18;letter-spacing:-2px;margin:26px 0}.store-copy p{font-size:21px;line-height:1.7;color:#4b635b}.store-copy .tag{font-size:14px;letter-spacing:1px;color:#517369}.store-copy .note{font-size:13px;color:#697f76;margin-top:26px}.store-copy img{width:74px;height:74px}';
    document.head.append(style);
    const copy=document.createElement('section');copy.className='store-copy';
    copy.innerHTML='<img src="../icons/icon-128.png" alt="Tracker icon"><p class="tag">CHATGPT MESSAGE TRACKER</p><h2>每次发送，<br>清楚有数。</h2><p>按模式记录发送次数。<br>本地保存，随时查看与修正。</p><p class="note">实际扩展界面 · 演示记录<br>独立工具，非 OpenAI 官方用量统计。</p>';
    document.body.append(copy);document.querySelector('#more-panel').open=false;
  })()`);
  await new Promise(r=>setTimeout(r,300));await shot(popup,'screenshot-01-1280x800.jpg');

  const options=await target(`chrome-extension://${extensionId}/src/options.html`);
  await metrics(options,1280,800);await wait(options);
  await shot(options,'screenshot-02-1280x800.jpg');

  // Reuse the existing product icon. Padding is added only to the store listing icon.
  const image=await evaluate(options,`(async()=>{
    const i=new Image();i.src='../icons/icon-128.png';await i.decode();
    const c=document.createElement('canvas');c.width=128;c.height=128;
    c.getContext('2d').drawImage(i,16,16,96,96);return c.toDataURL('image/png').split(',')[1];
  })()`);
  fs.writeFileSync(path.join(directory,'icon-128.png'),Buffer.from(image,'base64'));
  await metrics(options,440,280);
  await evaluate(options,`(() => {
    document.head.querySelector('link[rel="stylesheet"]')?.remove();
    document.body.innerHTML='<img src="../icons/icon-128.png" alt="Tracker icon"><strong>ChatGPT<br>Message Tracker</strong>';
    const s=document.createElement('style');s.textContent='html,body{margin:0;width:440px;height:280px;background:#0f3d31}body{display:flex;align-items:center;justify-content:center;gap:25px;color:white;font-family:system-ui,-apple-system,sans-serif}img{width:108px;height:108px}strong{font-size:24px;line-height:1.3;font-weight:650;letter-spacing:-.5px}';document.head.append(s);
  })()`);
  await new Promise(r=>setTimeout(r,200));await shot(options,'promo-440x280.jpg');
  return {files:fs.readdirSync(directory).filter(f=>/\.(?:jpg|png)$/.test(f)),data:'Isolated extension test records; not personal ChatGPT history',screenshot1:'Actual popup controls in a presentation frame',screenshot2:'Actual extension options page',promo:'Existing project icon and extension name'};
}
