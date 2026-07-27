export function resolveSiteEditorTabId(
  tabs: ReadonlyArray<{ id: string }>,
  requestedTabId: string | null | undefined,
): string {
  return requestedTabId && tabs.some((tab) => tab.id === requestedTabId)
    ? requestedTabId
    : tabs[0]?.id ?? ''
}

export function siteEditorTabHref(tabId: string, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch)
  params.set('flik', tabId)
  return `/admin/sida?${params.toString()}`
}
