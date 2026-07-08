// Repro-jakt Error 1102: temp salon_admin → hämta varje admin-sida ×3 mot prod,
// logga status + tid + 1102-träffar. Temp-usern raderas alltid.
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
const ref = new URL(url).hostname.split('.')[0]
const BASE = process.env.VERIFY_BASE ?? 'https://booking.corevo.se'
const EMAIL = 'verify-1102@corevo.se'
const PASS = 'Vg53!' + Math.random().toString(36).slice(2, 12)

const { data: t } = await admin.from('tenants').select('id').eq('slug', 'freshcut').single()
const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email: EMAIL, password: PASS, email_confirm: true, app_metadata: { tenant_id: t.id },
})
if (cErr) throw cErr
const uid = created.user.id
await admin.from('users').upsert({ id: uid, tenant_id: t.id, role_id: 'ed2047e5-1bf6-4025-9505-246e94a2ca25' })
try {
  const pub = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data: sess } = await pub.auth.signInWithPassword({ email: EMAIL, password: PASS })
  const raw = 'base64-' + Buffer.from(JSON.stringify(sess.session)).toString('base64url')
  const name = `sb-${ref}-auth-token`
  const cookies = raw.length <= 3180 ? [`${name}=${raw}`]
    : Array.from({ length: Math.ceil(raw.length / 3180) }, (_, i) => `${name}.${i}=${raw.slice(i * 3180, (i + 1) * 3180)}`)
  const cookieHeader = cookies.join('; ')

  const pages = ['/admin', '/admin/bokningar', '/admin/scheman', '/admin/sida', '/admin/kunder', '/admin/tjanster', '/admin/personal', '/admin/platser', '/admin/installningar', '/salong-preview/freshcut']
  for (const p of pages) {
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now()
      let line
      try {
        const res = await fetch(BASE + p, { headers: { cookie: cookieHeader } })
        const body = await res.text()
        const is1102 = body.includes('1102') && body.includes('resource limits')
        line = `${res.status}${is1102 ? ' **1102**' : ''} ${Date.now() - t0}ms`
      } catch (e) {
        line = `FETCH-ERR ${e.message}`
      }
      console.log(`${p} [${i}]: ${line}`)
    }
  }
} finally {
  await admin.from('users').delete().eq('id', uid)
  await admin.auth.admin.deleteUser(uid)
  console.log('temp-user raderad')
}
