import type { ReactNode } from 'react'
import { Callout } from '@/components/portal/ui'

export function ModuleWriteBoundary({
  readOnly,
  children,
}: {
  readOnly: boolean
  children: ReactNode
}) {
  return (
    <>
      {readOnly ? (
        <Callout tone="info" icon="info">
          Modulen är pausad. Innehållet går att läsa, men ändringar är låsta tills modulen
          sätts till Live.
        </Callout>
      ) : null}
      <fieldset
        disabled={readOnly}
        aria-disabled={readOnly || undefined}
        style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}
      >
        {children}
      </fieldset>
    </>
  )
}
