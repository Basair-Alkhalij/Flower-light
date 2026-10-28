import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'pwa-install.js'),'utf8');

function bootstrap(userAgent,enabled=true){
  const listeners={};
  const elements={};
  const classNames=new Set();
  const reminder={hidden:true,classList:{
    add:name=>classNames.add(name),
    remove:name=>classNames.delete(name)
  }};
  const action={textContent:'تثبيت',addEventListener:(type,fn)=>{listeners['action:'+type]=fn;}};
  const close={addEventListener:(type,fn)=>{listeners['close:'+type]=fn;}};
  const text={textContent:''};
  elements.pwaInstallReminder=reminder;
  elements.pwaInstallReminderAction=action;
  elements.pwaInstallReminderClose=close;
  elements.pwaInstallReminderText=text;
  const navigator={userAgent,maxTouchPoints:0,standalone:false};
  const window={
    navigator,
    FLOWER_LIGHT_SITE_SETTINGS:{pwa_install_enabled:enabled},
    matchMedia:()=>({matches:false}),
    addEventListener:(type,fn)=>{listeners[type]=fn;},
    setTimeout:fn=>{fn();return 1;},
    clearTimeout:()=>{}
  };
  const document={
    visibilityState:'visible',
    getElementById:id=>elements[id]||null
  };
  const context={window,navigator,document,
    location:{search:''},URLSearchParams,
    localStorage:{getItem:()=>null,setItem:()=>{}},
    requestAnimationFrame:fn=>fn(),
    console
  };
  vm.runInNewContext(source,context,{filename:'pwa-install.js'});
  return {window,reminder,action,text,listeners};
}

function offer(userAgent,enabled=true){
  const app=bootstrap(userAgent,enabled);
  let prevented=false;
  app.listeners.beforeinstallprompt({
    preventDefault(){prevented=true;},
    prompt:async()=>{},
    userChoice:Promise.resolve({outcome:'accepted'})
  });
  return {...app,prevented};
}

const androidChrome='Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const androidEdge=androidChrome+' EdgA/125.0.0.0';
const androidOpera=androidChrome+' OPR/80.0.0.0';
const androidXiaomi=androidChrome+' MiuiBrowser/18.0';
const androidWebView='Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36';
const samsung='Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S916B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/125.0.0.0 Mobile Safari/537.36';
const samsungOther=androidChrome+' SamsungBrowser/26.0';

for(const ua of [androidChrome,samsung]){
  const app=offer(ua);
  assert.equal(app.prevented,true,'Eligible Android browser must intercept native prompt');
  assert.equal(app.reminder.hidden,false,'Eligible Android browser must show banner');
  assert.equal(app.window.FL_PWA_INSTALL.hasNativePrompt(),true);
}
for(const ua of [androidEdge,androidOpera,androidXiaomi,androidWebView,samsungOther]){
  const app=offer(ua);
  assert.equal(app.prevented,false,'Potential shortcut browser must not be promoted');
  assert.equal(app.reminder.hidden,true,'Potential shortcut browser must not show banner');
  assert.equal(app.window.FL_PWA_INSTALL.hasNativePrompt(),false);
}
{
  const app=offer(androidChrome,false);
  assert.equal(app.reminder.hidden,true,'Owner toggle must suppress install banner');
  app.listeners['flowerlight:site-settings']({detail:{pwa_install_enabled:true}});
  assert.equal(app.reminder.hidden,false,'Owner toggle re-enable must restore install banner');
}
{
  const safari='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const app=bootstrap(safari,true);
  app.listeners['flowerlight:site-settings']({detail:{pwa_install_enabled:true}});
  assert.equal(app.reminder.hidden,false,'iOS keeps its manual install guidance');
  assert.equal(app.action.textContent,'كيف؟');
  assert.match(app.text.textContent,/المشاركة/);
}
console.log('PWA install browser eligibility: passed');
