// v1.7.2 prod verify: mobilbar i skalet, Schemavy-knapp, kiosk-rutten.
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ref = new URL(url).hostname.split('.')[0]
const ADM = 'https://booking.corevo.se'
const EMAIL = 'verify-v172@corevo.se'
const PASS = 'Vv172!' + Math.random().toString(36).slice(2, 12)
const ROLE_SALON_ADMIN = 'ed2047e5-1bf6-4025-9505-246e94a2ca25'

const admin = createClient(url, service)
const { data: t } = await admin.from('tenants').select('id').eq('slug', 'freshcut').single()

let failures = 0
const strip = (s) => s.replace(/<!--\s*-->/g, '')
async function check(path, mustHave, cookieHeader) {
  const res = await fetch(ADM + path, { headers: { cookie: cookieHeader }, redirect: 'follow' })
  const body = strip(await res.text())
  let ok = res.status === 200 && !res.url.includes('/login')
  const missing = mustHave.filter((m) => !body.includes(m))
  if (missing.length) ok = false
  console.log(`${ok ? 'PASS' : 'FAIL'} ${path} [${res.status}]${missing.length ? ' saknar: ' + missing.join(' | ') : ''}`)
  if (!ok) failures++
}

const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASS,
  email_confirm: true,
  app_metadata: { tenant_id: t.id },
})
if (cErr) throw cErr
const uid = created.user.id
const { error: uErr } = await admin
  .from('users')
  .upsert({ id: uid, tenant_id: t.id, role_id: ROLE_SALON_ADMIN })
if (uErr) {
  await admin.auth.admin.deleteUser(uid)
  throw uErr
}
try {
  const pub = createClient(url, anon)
  const { data: sess, error: sErr } = await pub.auth.signInWithPassword({ email: EMAIL, password: PASS })
  if (sErr) throw sErr
  const raw = 'base64-' + Buffer.from(JSON.stringify(sess.session)).toString('base64url')
  const name = `sb-${ref}-auth-token`
  const cookies = []
  if (raw.length <= 3180) cookies.push(`${name}=${raw}`)
  else
    for (let i = 0; i * 3180 < raw.length; i++)
      cookies.push(`${name}.${i}=${raw.slice(i * 3180, (i + 1) * 3180)}`)
  const cookieHeader = cookies.join('; ')

  await check('/admin', ['portal-mobilebar'], cookieHeader)
  await check('/admin/scheman', ['Schemavy', 'portal-mobilebar'], cookieHeader)
  await check('/admin/scheman/vy', ['schedule-kiosk', 'Vecka', 'Till admin', 'Hilal'], cookieHeader)
} finally {
  await admin.from('users').delete().eq('id', uid)
  await admin.auth.admin.deleteUser(uid)
  console.log('temp-user raderad')
}
console.log(failures === 0 ? 'ALLA GRÖNA' : `${failures} FAIL`)
process.exit(failures === 0 ? 0 : 1)
