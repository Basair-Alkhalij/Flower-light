import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPinnedSupabaseVendor, SUPABASE_VENDOR_SHA256 } from '../scripts/vendor-integrity.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const buildSource=fs.readFileSync(path.join(root,'scripts/build.mjs'),'utf8');

assert.match(SUPABASE_VENDOR_SHA256,/^[a-f0-9]{64}$/);
assert.match(buildSource,/import \{ assertPinnedSupabaseVendor \} from '\.\/vendor-integrity\.mjs'/);
const verifiedAt=buildSource.indexOf('assertPinnedSupabaseVendor(supabaseVendor)');
const writtenAt=buildSource.indexOf("fs.writeFileSync(path.join(out,'supabase-vendor.js')");
assert.ok(verifiedAt>=0 && writtenAt>verifiedAt,'Vendor bytes must be verified before publication');

// Negative checks run without esbuild, network access or temporary artifacts.
assert.throws(
  ()=>assertPinnedSupabaseVendor(Buffer.alloc(120_000,0x41)),
  /Pinned Supabase SHA-256 mismatch/
);
assert.throws(
  ()=>assertPinnedSupabaseVendor(Buffer.alloc(32,0x41)),
  /Supabase vendor file is unexpectedly small/
);
console.log('Supabase vendor SHA-256 integrity rejection: passed');
