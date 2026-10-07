import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const allowedOrigins = new Set([
  'https://basair-alkhalij.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
])

const allowedTurnstileHosts = new Set(['basair-alkhalij.github.io', 'localhost', '127.0.0.1'])

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function jsonResponse(status: number, payload: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function text(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

function phoneDigits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 20)
}

function clientIp(request: Request) {
  // Supabase's gateway exposes Cloudflare's client address header. Do not trust
  // a caller-supplied X-Forwarded-For chain for rate limiting.
  const cloudflare = request.headers.get('cf-connecting-ip')?.trim()
  if (cloudflare) return cloudflare
  const realIp = request.headers.get('x-real-ip')?.trim()
  return realIp || 'unknown'
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

type TurnstileResult = {
  success?: boolean
  hostname?: string
  action?: string
  ['error-codes']?: string[]
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin')
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse(403, { error: 'Origin not allowed.' }, null)
  }
  if (request.method === 'OPTIONS') return new Response('ok', { headers: { ...corsHeaders(origin), 'Cache-Control': 'no-store' } })
  if (request.method !== 'POST') return jsonResponse(405, { error: 'الطريقة غير مسموحة.' }, origin)
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('application/json')) return jsonResponse(415, { error: 'نوع البيانات غير مدعوم.' }, origin)
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (Number.isFinite(contentLength) && contentLength > 8192) return jsonResponse(413, { error: 'حجم الطلب أكبر من المسموح.' }, origin)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY')
    if (!supabaseUrl || !serviceRoleKey || !turnstileSecret) {
      return jsonResponse(500, { error: 'إعداد الحماية غير مكتمل على الخادم.' }, origin)
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return jsonResponse(400, { error: 'بيانات الطلب غير صالحة.' }, origin)
    }

    const fullName = text(body.full_name, 120)
    const companyName = text(body.company_name, 120)
    const mobile = text(body.mobile, 30)
    const digits = phoneDigits(mobile)
    const token = text(body.turnstile_token, 2048)

    if (fullName.length < 2) return jsonResponse(422, { error: 'اكتب الاسم بشكل صحيح.' }, origin)
    if (companyName && companyName.length < 2) return jsonResponse(422, { error: 'اكتب اسم الشركة بشكل صحيح أو اتركه فارغًا.' }, origin)
    if (digits.length < 9 || digits.length > 15) return jsonResponse(422, { error: 'اكتب رقم جوال صحيح.' }, origin)
    if (!token) return jsonResponse(400, { error: 'أكمل التحقق الأمني ثم حاول مرة أخرى.' }, origin)

    const ip = clientIp(request)
    const verifyBody = new FormData()
    verifyBody.set('secret', turnstileSecret)
    verifyBody.set('response', token)
    if (ip !== 'unknown') verifyBody.set('remoteip', ip)
    verifyBody.set('idempotency_key', crypto.randomUUID())

    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: verifyBody,
      signal: AbortSignal.timeout(10_000),
    })
    const verification = await verifyResponse.json() as TurnstileResult
    if (!verifyResponse.ok || verification.success !== true) {
      console.warn('[submit-customer-lead] Turnstile rejected', verification['error-codes'] ?? [])
      return jsonResponse(400, { error: 'تعذر التحقق الأمني. أعد المحاولة.' }, origin)
    }
    if (verification.action !== 'customer_lead') {
      return jsonResponse(400, { error: 'تعذر التحقق الأمني. أعد المحاولة.' }, origin)
    }
    if (!verification.hostname || !allowedTurnstileHosts.has(verification.hostname)) {
      return jsonResponse(400, { error: 'تعذر التحقق الأمني. أعد المحاولة.' }, origin)
    }
    if (origin && new URL(origin).hostname !== verification.hostname) {
      return jsonResponse(400, { error: 'تعذر التحقق الأمني. أعد المحاولة.' }, origin)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Keep only a salted hash of the network address. Raw IP addresses are never stored.
    const pepper = Deno.env.get('LEAD_RATE_LIMIT_PEPPER') || turnstileSecret
    const ipHash = await sha256Hex(`${pepper}:${ip}`)
    const { data: allowed, error: rateError } = await admin.rpc('consume_customer_lead_rate_limit', {
      p_key: ipHash,
      p_limit: 8,
      p_window_seconds: 300,
    })
    if (rateError) {
      console.error('[submit-customer-lead] rate limit RPC failed', rateError.message)
      return jsonResponse(500, { error: 'إعداد حماية العملاء يحتاج تحديث قاعدة البيانات.' }, origin)
    }
    if (allowed !== true) return jsonResponse(429, { error: 'محاولات كثيرة من هذا الاتصال. حاول بعد عدة دقائق.' }, origin)

    const { error: insertError } = await admin.from('customer_leads').insert({
      full_name: fullName,
      company_name: companyName,
      mobile,
    })
    if (insertError) {
      console.error('[submit-customer-lead] insert failed', insertError.message)
      return jsonResponse(500, { error: 'تعذر حفظ البيانات الآن. حاول مرة أخرى.' }, origin)
    }

    // Retention cleanup is deliberately non-fatal for the visitor. A daily pg_cron
    // job is installed when available; this call is the server-side fallback.
    const { error: retentionError } = await admin.rpc('purge_expired_customer_leads')
    if (retentionError) console.warn('[submit-customer-lead] retention cleanup failed', retentionError.message)

    return jsonResponse(200, { ok: true }, origin)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[submit-customer-lead]', message)
    return jsonResponse(500, { error: 'تعذر إكمال الطلب الآن. حاول مرة أخرى.' }, origin)
  }
})
