import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

// Only the production site (and local testing on 127.0.0.1 / localhost) may call
// this function directly from a browser. Server-to-server calls (CI health checks,
// curl, etc.) do not send an Origin header and are unaffected by this allow-list.
const allowedOrigins = new Set([
  'https://basair-alkhalij.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
])

function buildCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

const allowedPermissions = new Set([
  'analytics',
  'profile',
  'contacts',
  'leads',
  'datasheet',
])

type AdminClient = ReturnType<typeof createClient>


function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizePermissions(value: unknown, fallback: string[] = []) {
  const source = Array.isArray(value) ? value : fallback
  return [...new Set(source.map(String).filter((permission) => allowedPermissions.has(permission)))]
}

function randomPassword() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return `${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}Aa1!`
}

async function findUserByEmail(client: AdminClient, email: string) {
  const perPage = 500
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const user = data.users.find((item) => normalizeEmail(item.email) === email)
    if (user) return user
    if (data.users.length < perPage) return null
  }
  throw new Error('تعذر البحث في جميع حسابات المستخدمين. تواصل مع مسؤول Supabase.')
}

async function getRoleUser(client: AdminClient, role: 'owner' | 'subadmin') {
  const { data: rows, error } = await client
    .from('admin_users')
    .select('user_id, role, permissions, created_at')
    .eq('role', role)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  return rows?.[0] ?? null
}

async function getUserEmail(client: AdminClient, userId: string | undefined) {
  if (!userId) return ''
  const { data, error } = await client.auth.admin.getUserById(userId)
  if (error) throw error
  return normalizeEmail(data.user?.email)
}

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get('origin')
  if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
    return new Response('Origin not allowed', { status: 403, headers: { 'Vary': 'Origin' } })
  }
  const corsHeaders = buildCorsHeaders(requestOrigin)
  function response(status: number, payload: Record<string, unknown>) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response(405, { error: 'الطريقة غير مسموحة.' })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return response(500, { error: 'إعدادات Supabase الداخلية غير متاحة.' })
    }

    const authorization = request.headers.get('Authorization') ?? ''
    const token = authorization.replace(/^Bearer\s+/i, '').trim()
    if (!token) return response(401, { error: 'افتح رابط الاستعادة أو سجّل دخول المدير أولًا.' })

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: callerData, error: callerError } = await adminClient.auth.getUser(token)
    const caller = callerData.user
    if (callerError || !caller) return response(401, { error: 'الجلسة غير صالحة. افتح رابطًا جديدًا وحاول مجددًا.' })

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return response(400, { error: 'بيانات الطلب غير صالحة.' })
    }
    const action = String(body.action ?? '')

    const [{ data: ownerAccess, error: ownerAccessError }, { data: recoverySettings, error: recoveryError }] = await Promise.all([
      adminClient
        .from('admin_users')
        .select('user_id')
        .eq('user_id', caller.id)
        .eq('role', 'owner')
        .maybeSingle(),
      adminClient
        .from('admin_recovery_settings')
        .select('id, recovery_user_id, recovery_email, updated_at')
        .eq('id', 1)
        .maybeSingle(),
    ])
    if (ownerAccessError) throw ownerAccessError
    if (recoveryError) {
      if (String(recoveryError.code) === '42P01') {
        return response(500, { error: 'شغّل ملف SUPABASE_SETUP.sql في Supabase أولًا.' })
      }
      throw recoveryError
    }

    const isOwner = Boolean(ownerAccess)
    const isRecoveryUser = Boolean(recoverySettings?.recovery_user_id === caller.id)

    if (action === 'get_recovery_settings') {
      if (!isOwner) return response(403, { error: 'هذه العملية متاحة للمدير فقط.' })
      return response(200, {
        ok: true,
        configured: Boolean(recoverySettings?.recovery_user_id && recoverySettings?.recovery_email),
        recovery_email: normalizeEmail(recoverySettings?.recovery_email),
        updated_at: recoverySettings?.updated_at ?? null,
      })
    }

    if (action === 'save_recovery_email') {
      if (!isOwner) return response(403, { error: 'هذه العملية متاحة للمدير فقط.' })
      const email = normalizeEmail(body.email)
      if (!validEmail(email)) return response(422, { error: 'اكتب بريد استعادة أساسيًا صحيحًا.' })

      const existingUser = await findUserByEmail(adminClient, email)
      let recoveryUserId = existingUser?.id ?? ''
      if (!recoveryUserId) {
        const { data, error } = await adminClient.auth.admin.createUser({
          email,
          password: randomPassword(),
          email_confirm: true,
          app_metadata: { flower_light_recovery_only: true },
        })
        if (error || !data.user) throw error ?? new Error('تعذر إنشاء حساب الاستعادة الأساسي.')
        recoveryUserId = data.user.id
      }

      const previousRecoveryUserId = String(recoverySettings?.recovery_user_id ?? '')
      const { error: upsertError } = await adminClient
        .from('admin_recovery_settings')
        .upsert({
          id: 1,
          recovery_user_id: recoveryUserId,
          recovery_email: email,
          updated_at: new Date().toISOString(),
          updated_by: caller.id,
        }, { onConflict: 'id' })
      if (upsertError) throw upsertError

      if (previousRecoveryUserId && previousRecoveryUserId !== recoveryUserId) {
        const { data: previousData } = await adminClient.auth.admin.getUserById(previousRecoveryUserId)
        const previousUser = previousData.user
        if (previousUser?.app_metadata?.flower_light_recovery_only === true) {
          await adminClient.auth.admin.deleteUser(previousRecoveryUserId)
        }
      }

      return response(200, {
        ok: true,
        recovery_email: email,
        recovery_user_id: recoveryUserId,
      })
    }

    if (action === 'get_recovery_context') {
      if (!isRecoveryUser) return response(403, { error: 'هذا الرابط غير مرتبط بالبريد الأساسي للاستعادة.' })
      const [owner, subadmin] = await Promise.all([
        getRoleUser(adminClient, 'owner'),
        getRoleUser(adminClient, 'subadmin'),
      ])
      const [ownerEmail, subadminEmail] = await Promise.all([
        getUserEmail(adminClient, owner?.user_id),
        getUserEmail(adminClient, subadmin?.user_id),
      ])
      return response(200, {
        ok: true,
        recovery_email: normalizeEmail(recoverySettings?.recovery_email),
        owner_email: ownerEmail,
        admin_email: subadminEmail,
        has_admin: Boolean(subadmin?.user_id),
      })
    }

    if (action === 'recovery_update_credentials') {
      if (!isRecoveryUser) return response(403, { error: 'هذا الرابط غير مخوّل لتعديل الحسابات.' })
      const role = body.role === 'owner' ? 'owner' : body.role === 'subadmin' ? 'subadmin' : ''
      if (!role) return response(422, { error: 'اختر حساب المدير أو الأدمن.' })
      const target = await getRoleUser(adminClient, role)
      if (!target?.user_id) return response(404, { error: role === 'owner' ? 'حساب المدير غير موجود.' : 'حساب الأدمن غير موجود.' })

      const currentEmail = await getUserEmail(adminClient, target.user_id)
      const requestedEmail = normalizeEmail(body.email)
      const email = requestedEmail || currentEmail
      const password = typeof body.password === 'string' ? body.password : ''
      const emailChanged = Boolean(requestedEmail && requestedEmail !== currentEmail)
      if (requestedEmail && !validEmail(requestedEmail)) return response(422, { error: 'اكتب بريدًا إلكترونيًا صحيحًا.' })
      if (password && password.length < 8) return response(422, { error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.' })
      if (!emailChanged && !password) return response(422, { error: 'أدخل بريدًا جديدًا أو كلمة مرور جديدة.' })

      if (emailChanged) {
        const userWithEmail = await findUserByEmail(adminClient, email)
        if (userWithEmail && userWithEmail.id !== target.user_id) {
          return response(409, { error: 'هذا البريد مرتبط بحساب آخر بالفعل.' })
        }
      }

      const attributes: { email?: string; password?: string; email_confirm?: boolean } = {}
      if (emailChanged) {
        attributes.email = email
        attributes.email_confirm = true
      }
      if (password) attributes.password = password
      const { error } = await adminClient.auth.admin.updateUserById(target.user_id, attributes)
      if (error) throw error

      if (emailChanged && target.user_id === recoverySettings?.recovery_user_id) {
        const { error: recoveryUpdateError } = await adminClient
          .from('admin_recovery_settings')
          .update({ recovery_email: email, updated_at: new Date().toISOString() })
          .eq('id', 1)
        if (recoveryUpdateError) throw recoveryUpdateError
      }

      return response(200, {
        ok: true,
        role,
        email,
        email_changed: emailChanged,
        password_changed: Boolean(password),
      })
    }

    if (action !== 'save_admin_credentials') {
      return response(400, { error: 'العملية المطلوبة غير معروفة.' })
    }

    if (!isOwner) return response(403, { error: 'هذه العملية متاحة للمدير فقط.' })

    const email = normalizeEmail(body.email)
    const password = typeof body.password === 'string' ? body.password : ''
    if (!validEmail(email)) return response(422, { error: 'اكتب بريدًا إلكترونيًا صحيحًا للأدمن.' })
    if (password && password.length < 8) return response(422, { error: 'كلمة مرور الأدمن يجب أن تكون 8 أحرف على الأقل.' })
    if (email === normalizeEmail(caller.email)) return response(422, { error: 'يجب أن يكون بريد الأدمن مختلفًا عن بريد المدير.' })

    const currentSubadmin = await getRoleUser(adminClient, 'subadmin')
    const currentEmail = await getUserEmail(adminClient, currentSubadmin?.user_id)
    const emailChanged = !currentSubadmin || currentEmail !== email
    if (emailChanged && password.length < 8) {
      return response(422, { error: 'عند إنشاء حساب الأدمن أو تغيير بريده يجب تعيين كلمة مرور من 8 أحرف على الأقل.' })
    }

    const permissions = normalizePermissions(
      body.permissions,
      Array.isArray(currentSubadmin?.permissions) ? currentSubadmin.permissions : [],
    )
    const userWithRequestedEmail = await findUserByEmail(adminClient, email)
    let targetUserId = ''
    let operation = 'updated'

    if (userWithRequestedEmail) {
      if (userWithRequestedEmail.id === caller.id) {
        return response(422, { error: 'لا يمكن استخدام حساب المدير كحساب للأدمن.' })
      }
      if (userWithRequestedEmail.id === recoverySettings?.recovery_user_id && userWithRequestedEmail.id !== currentSubadmin?.user_id) {
        return response(422, { error: 'هذا البريد مستخدم كبريد الاستعادة الأساسي. اختر بريدًا آخر للأدمن.' })
      }

      const { data: targetAdminRow, error: targetAdminError } = await adminClient
        .from('admin_users')
        .select('role')
        .eq('user_id', userWithRequestedEmail.id)
        .maybeSingle()
      if (targetAdminError) throw targetAdminError
      if (targetAdminRow?.role === 'owner') {
        return response(422, { error: 'هذا البريد مرتبط بحساب مدير ولا يمكن تحويله إلى أدمن.' })
      }

      targetUserId = userWithRequestedEmail.id
      if (password) {
        const { error } = await adminClient.auth.admin.updateUserById(targetUserId, { password })
        if (error) throw error
      }
      operation = currentSubadmin?.user_id === targetUserId ? 'updated' : 'relinked'
    } else if (currentSubadmin?.user_id) {
      targetUserId = currentSubadmin.user_id
      const attributes: { email?: string; password?: string; email_confirm?: boolean } = {}
      if (currentEmail !== email) {
        attributes.email = email
        attributes.email_confirm = true
      }
      if (password) attributes.password = password
      const { error } = await adminClient.auth.admin.updateUserById(targetUserId, attributes)
      if (error) throw error
      operation = 'updated'
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error || !data.user) throw error ?? new Error('تعذر إنشاء حساب الأدمن.')
      targetUserId = data.user.id
      operation = 'created'
    }

    const { error: deleteError } = await adminClient
      .from('admin_users')
      .delete()
      .eq('role', 'subadmin')
      .neq('user_id', targetUserId)
    if (deleteError) throw deleteError

    const { error: upsertError } = await adminClient
      .from('admin_users')
      .upsert(
        { user_id: targetUserId, role: 'subadmin', permissions },
        { onConflict: 'user_id' },
      )
    if (upsertError) throw upsertError

    return response(200, {
      ok: true,
      operation,
      user_id: targetUserId,
      email,
      permissions,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[manage-admin-account]', message)
    if (/already.*registered|already.*exists|email.*taken/i.test(message)) {
      return response(409, { error: 'هذا البريد مرتبط بحساب آخر بالفعل.' })
    }
    return response(500, { error: `تعذر تنفيذ العملية: ${message}` })
  }
})
