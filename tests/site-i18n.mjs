import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../site-i18n.js',import.meta.url),'utf8');
const storage=new Map();
const localStorage={
  getItem:key=>storage.get(key)??null,
  setItem:(key,value)=>storage.set(key,value),
};
const document={
  readyState:'loading',
  documentElement:{lang:'ar',dir:'rtl',dataset:{}},
  title:'بصائر الخليج | مستودع منتجات فلور لايت',
  addEventListener(){},
  getElementById(){return null;},
  body:null
};
const events=[];
const window={
  dispatchEvent(event){events.push(event);},
};
class MutationObserver {observe(){}}
class CustomEvent{constructor(name,options){this.type=name;this.detail=options.detail;}}
const context={window,document,location:{search:''},localStorage,MutationObserver,CustomEvent,URLSearchParams,console,queueMicrotask};
vm.runInNewContext(source,context);
assert.equal(window.FL_I18N.lang,'ar');
assert.equal(window.FL_I18N.translate('منتجاتنا'),'منتجاتنا');
window.FL_I18N.setLanguage('en');
assert.equal(window.FL_I18N.lang,'en');
assert.equal(document.documentElement.lang,'en');
assert.equal(document.documentElement.dir,'ltr');
assert.equal(storage.get('flowerlight:public-language'),'en');
assert.equal(window.FL_I18N.translate('منتجاتنا'),'Our Products');
assert.equal(window.FL_I18N.translate('قائمة الطلب (3)'),'Order list (3)');
assert.equal(window.FL_I18N.translate('لا توجد نتائج مطابقة للبحث والفلاتر'),'No matching products. Try changing your search or filters.');
assert.equal(window.FL_I18N.translate('مصباح LED خاص بالعميل'),'مصباح LED خاص بالعميل','untranslated product data must not be invented');
assert.equal(events.at(-1).detail.language,'en');
window.FL_I18N.setLanguage('ar');
assert.equal(document.documentElement.lang,'ar');
assert.equal(document.documentElement.dir,'rtl');
assert.equal(window.FL_I18N.translate('منتجاتنا'),'منتجاتنا');
const blocked={
  getItem(){throw Error('storage unavailable');},
  setItem(){throw Error('storage unavailable');}
};
const other={window:{dispatchEvent(){}},document:{...document,documentElement:{dataset:{}}},location:{search:''},localStorage:blocked,MutationObserver,CustomEvent,URLSearchParams,console,queueMicrotask};
vm.runInNewContext(source,other);
assert.equal(other.window.FL_I18N.lang,'ar');
assert.doesNotThrow(()=>other.window.FL_I18N.setLanguage('en'));
assert.equal(other.window.FL_I18N.lang,'en');
const adminWindow={};
vm.runInNewContext(source,{...context,window:adminWindow,location:{search:'?admin=1'}});
assert.equal(adminWindow.FL_I18N,undefined,'Admin UI should not be changed');
console.log('SITE_I18N_OK');
