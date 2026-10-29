import crypto from 'node:crypto';

// Verified from the byte-for-byte @supabase/supabase-js@2.57.4 UMD bundle
// downloaded by GitHub Actions. Any upstream change requires a deliberate review.
export const SUPABASE_VENDOR_SHA256='7e94b62086deecef8c0ba3b38f514e2a1944ff6c81d92fb3ff967828c406c38f';

export function assertPinnedSupabaseVendor(bytes) {
  if(!bytes || bytes.length<100_000) throw new Error('Supabase vendor file is unexpectedly small');
  const digest=crypto.createHash('sha256').update(bytes).digest('hex');
  if(digest!==SUPABASE_VENDOR_SHA256) throw new Error('Pinned Supabase SHA-256 mismatch');
  return digest;
}
