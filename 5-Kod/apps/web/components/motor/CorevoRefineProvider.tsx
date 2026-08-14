'use client'

import { type ReactNode, useMemo } from 'react'
import { Refine, type AccessControlProvider } from '@refinedev/core'
import {
  canUseCorevoResource,
  type CorevoServiceCapabilities,
} from '@/lib/motor/corevo-refine-access'
import { corevoDataProvider } from '@/lib/motor/corevo-data-provider'
import { COREVO_REFINE_RESOURCES } from '@/lib/motor/corevo-refine-resources'

export function CorevoRefineProvider({
  children,
  capabilities,
}: {
  children: ReactNode
  capabilities: CorevoServiceCapabilities
}) {
  const accessControlProvider = useMemo<AccessControlProvider>(
    () => ({
      can: async ({ resource, action }) => ({
        can: canUseCorevoResource(resource, action, capabilities),
      }),
    }),
    [capabilities],
  )

  return (
    <Refine
      dataProvider={corevoDataProvider}
      accessControlProvider={accessControlProvider}
      resources={[...COREVO_REFINE_RESOURCES]}
      options={{ disableTelemetry: true }}
    >
      {children}
    </Refine>
  )
}
