import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const buildSource=fs.readFileSync(path.join(root,'scripts/build.mjs'),'utf8');

assert.match(buildSource,/const pinnedSupabaseSha256='[a-f0-9]{64}'/);
assert.match(buildSource,/supabaseSha256!==pinnedSupabaseSha256/);
assert.match(buildSource,/Pinned Supabase SHA-256 mismatch/);

// Exercise the actual production build path with a deliberately tampered file.
// It must reject the file before it can be written into dist or deployed.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flower-light-vendor-integrity-'));
const invalidVendor=path.join(dir,'supabase-vendor.js');
try {
  fs.writeFileSync(invalidVendor,Buffer.alloc(120_000,0x41));
  const result=spawnSync(process.execPath,['scripts/build.mjs'],{
    cwd:root,
    encoding:'utf8',
    timeout:45_000,
    env:{...process.env,FL_SUPABASE_VENDOR_FILE:invalidVendor,FL_SKIP_STATIC_PAGES:'1'},
  });
  assert.notEqual(result.status,0,'Build must fail if vendor integrity is invalid');
  assert.match((result.stdout||'')+'\n'+(result.stderr||''),/Pinned Supabase SHA-256 mismatch/);
  console.log('Supabase vendor integrity negative build: passed');
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
}
