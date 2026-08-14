const SERVICE_ACTIONS = ['list', 'create', 'edit', 'delete'] as const

export type CorevoServiceAction = (typeof SERVICE_ACTIONS)[number]
export type CorevoServiceCapabilities = Record<CorevoServiceAction, boolean>

export function canUseCorevoResource(
  resource: string | undefined,
  action: string,
  capabilities: CorevoServiceCapabilities,
): boolean {
  return (
    resource === 'services' &&
    SERVICE_ACTIONS.includes(action as CorevoServiceAction) &&
    capabilities[action as CorevoServiceAction] === true
  )
}
