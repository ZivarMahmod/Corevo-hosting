export function resolveSiteEditorTabId(
  tabs: ReadonlyArray<{ id: string }>,
  requestedTabId: string | null | undefined,
): string {
  return requestedTabId && tabs.some((tab) => tab.id === requestedTabId)
    ? requestedTabId
    : tabs[0]?.id ?? ''
}

export function siteEditorTabHref(pathname: string, tabId: string, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch)
  params.set('flik', tabId)
  return `${pathname}?${params.toString()}`
}

export function siteEditorPreviewSrc(
  previewPath: string,
  activePath: string,
  theme?: string,
  copyMode?: string,
): string {
  const [pathAndSearch = '', hash = ''] = activePath.split('#', 2)
  const [routePath = '', routeSearch = ''] = pathAndSearch.split('?', 2)
  const params = new URLSearchParams(routeSearch)
  if (theme) params.set('theme', theme)
  if (theme && copyMode) params.set('copy', copyMode)
  const query = params.toString()
  return `${previewPath}${routePath}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`
}
