'use client'

import { useRef, useState, useTransition } from 'react'
import { saveCustomerNote } from '@/lib/admin/actions'
import styles from './kunder-v2.module.css'

/** KLIENTKORT: fri anteckning (customer_notes.internal_note), autosparas på blur.
 *  Blur i stället för debounce-per-tangent = ett skrivvänligt, ärligt spar utan att
 *  spamma servern. Sparar bara när texten faktiskt ändrats. */
export function CustomerNoteEditor({
  customerId,
  initial,
}: {
  customerId: string
  initial: string
}) {
  const [value, setValue] = useState(initial)
  const saved = useRef(initial)
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')

  function persist() {
    if (value === saved.current) return
    const fd = new FormData()
    fd.set('customer_id', customerId)
    fd.set('note', value)
    startTransition(async () => {
      const res = await saveCustomerNote({}, fd)
      if (res.error) {
        setStatus('error')
      } else {
        saved.current = value
        setStatus('ok')
      }
    })
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.eyebrow}>KLIENTKORT</div>
      </div>
      <textarea
        className={styles.note}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setStatus('idle')
        }}
        onBlur={persist}
        placeholder="Anteckningar om kunden — färgrecept, önskemål, allergier…"
        maxLength={2000}
      />
      <div className={styles.noteFoot}>
        <span>
          {pending
            ? 'sparar…'
            : status === 'ok'
              ? 'sparad ✓'
              : status === 'error'
                ? 'kunde inte spara'
                : 'sparas automatiskt'}
        </span>
      </div>
    </div>
  )
}
