'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type ToastTone = 'success' | 'warning' | 'info' | 'gold'

const TONE_ICON: Record<ToastTone, IconName> = {
  success: 'check',
  warning: 'alert',
  info: 'info',
  gold: 'link',
}

type ToastItem = { id: number; message: ReactNode; tone: ToastTone; leaving?: boolean }

type ToastApi = {
  /** Fire one consequence toast (playbook §4.10 — the röd-tråd backbone). */
  notify: (message: ReactNode, tone?: ToastTone) => void
}

const ToastCtx = createContext<ToastApi | null>(null)

/**
 * Hook for any client component under a back-office shell to fire a Swedish
 * consequence toast after a mutating action ("Tid 17:00 frigjord — åter
 * bokningsbar"). Falls back to a no-op if no provider is mounted, so a component
 * can be used outside the shell without crashing.
 */
export function useToast(): ToastApi {
  return useContext(ToastCtx) ?? { notify: () => {} }
}

/**
 * Toast provider (playbook §4.10). Mounted once in the back-office shell
 * (PortalShell), it renders a bottom-centre stack: forest pills, white text,
 * a tone-coloured icon-chip, slide-up entrance, auto-dismiss after 3400ms.
 * Styling in app/portal-global.css (.bo-toast*).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const remove = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    window.setTimeout(() => {
      setItems((list) => list.filter((t) => t.id !== id))
    }, 300)
  }, [])

  const notify = useCallback(
    (message: ReactNode, tone: ToastTone = 'success') => {
      const id = (idRef.current += 1)
      setItems((list) => [...list, { id, message, tone }])
      window.setTimeout(() => remove(id), 3400)
    },
    [remove],
  )

  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      <div className="bo-toast-wrap" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`bo-toast${t.leaving ? ' is-leaving' : ''}`} role="status">
            <span className={`bo-toast-chip bo-toast-chip--${t.tone}`} aria-hidden="true">
              <Icon name={TONE_ICON[t.tone]} size={15} />
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
