import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../admin-mfa.js',import.meta.url),'utf8');
const window={};
vm.runInNewContext(source,{window});
const mfa=window.FL_ADMIN_MFA;
assert.equal(typeof mfa.requireStepUp,'function');
assert.equal(typeof mfa.renderSettings,'function');
assert.equal(mfa.validCode('123456'),true);
assert.equal(mfa.validCode('1234567'),false);
assert.equal(mfa.validCode('123a56'),false);
assert.match(source,/mfa_factor_name_conflict/);
assert.match(source,/factor\?\.status==='unverified'/);
assert.match(source,/friendlyName:chosen/);
assert.match(source,/flMfaNewName/);
assert.match(source,/auth\.updateUser\(\{data:\{\[aliasKey\]:existing\}\}\)/);
assert.match(source,/mfa\.challengeAndVerify\(\{factorId:factor\.id,code\}\)/);
assert.match(source,/mfa\.unenroll\(\{factorId:factor\.id\}\)/);
assert.match(source,/إلغاء التحقق بخطوتين/);
assert.match(source,/إلغاء محاولة الربط/);
assert.doesNotMatch(source.replace(/^\s*\/\/.*$/gm,''),/\b(?:localStorage|sessionStorage)\s*\.|console\.(?:log|warn)\s*\(/,'MFA secrets must not be persisted or logged');

const api=(factors,level,next)=>({
  listFactors:async()=>({data:{totp:factors},error:null}),
  getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:level,nextLevel:next},error:null}),
  challengeAndVerify:async()=>({data:{},error:null}),
  enroll:async()=>({data:{},error:null}),
  unenroll:async()=>({data:{},error:null}),
});
assert.equal(await mfa.requireStepUp({auth:{mfa:api([],'aal1','aal1')}},null),true,
  'No verified factors: preserve legacy sign-in during opt-in onboarding');
assert.equal(await mfa.requireStepUp({auth:{mfa:api([{id:'factor1',status:'verified',factor_type:'totp'}],'aal2','aal2')}},null),true);
await assert.rejects(()=>mfa.requireStepUp({auth:{}},null),/التحقق بخطوتين/);
await assert.rejects(()=>mfa.requireStepUp({auth:{mfa:api([{id:'factor1',status:'verified',factor_type:'totp'}],'aal1','aal1')}},null),/الخادم/);
assert.match(fs.readFileSync(new URL('../admin.js',import.meta.url),'utf8'),/FL_ADMIN_MFA\.requireStepUp/);
assert.match(fs.readFileSync(new URL('../site-loader.js',import.meta.url),'utf8'),/admin-mfa\.js\?v=__FL_VERSION__/);
console.log('ADMIN_MFA_UNIT_OK');
