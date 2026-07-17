'use client'

import { useEffect, useState } from 'react'
import { savePushSubscription } from '@/app/(kund)/konto/push-actions'

// Plan 015 steg 4: fråga kunden om pushnotiser på /konto. Renderar INGET när
// förutsättningar saknas (ingen VAPID-nyckel byggd, webbläsare utan push, redan
// prenumererad eller blockerad) — ytan är en mjuk nudge, aldrig ett krav.
// iOS: push kräver att PWA:n lagts till på hemskärmen — tills dess syns inget
// (Notification finns inte i Safari-flik) och e-post/SMS bär notiserna (plan 014).

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function PushOptIn() {
  const [state, setState] = useState<'hidden' | 'idle' | 'working' | 'done' | 'error'>('hidden')

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!('Notification' in window) || Notification.permission === 'denied') return
    // Redan prenumererad? Visa inget.
    navigator.serviceWorker
      .getRegistration('/')
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (!sub) setState('idle')
      })
      .catch(() => setState('idle'))
  }, [])

  if (state === 'hidden' || state === 'done') return null

  const enable = async () => {
    setState('working')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('hidden')
        return
      }
      const reg = await navigator.serviceWorker.register('/kund-sw.js')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
      const json = sub.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('bad_subscription')
      const result = await savePushSubscription({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      })
      setState(result.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 16px',
        border: '1px solid var(--color-line, rgba(0,0,0,0.12))',
        borderRadius: 12,
      }}
    >
      <div>
        <strong style={{ display: 'block', fontSize: 14 }}>Få notiser om dina bokningar</strong>
        <span style={{ fontSize: 12.5, opacity: 0.75 }}>
          {state === 'error'
            ? 'Något gick fel — prova igen.'
            : 'Påminnelser och bekräftelser direkt i mobilen, utan SMS.'}
        </span>
      </div>
      <button
        type="button"
        onClick={enable}
        disabled={state === 'working'}
        style={{
          padding: '8px 14px',
          borderRadius: 999,
          border: 'none',
          background: 'var(--color-primary, #1f3d2e)',
          color: '#fff',
          font: 'inherit',
          fontSize: 13.5,
          fontWeight: 600,
          cursor: state === 'working' ? 'progress' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {state === 'working' ? 'Aktiverar…' : 'Aktivera notiser'}
      </button>
    </div>
  )
}
