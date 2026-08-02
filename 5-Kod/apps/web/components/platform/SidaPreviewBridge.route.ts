export function directPreviewHref(
  slug: string,
  path: string,
  targetSearch: string,
  currentSearch: string,
  targetHash = '',
): string {
  const params = new URLSearchParams()
  const current = new URLSearchParams(currentSearch)
  for (const key of ['theme', 'copy']) {
    const value = current.get(key)
    if (value !== null) params.set(key, value)
  }
  new URLSearchParams(targetSearch).forEach((value, key) => params.set(key, value))
  const query = params.toString()
  return `/salong-preview/${slug}${path}${query ? `?${query}` : ''}${targetHash}`
}
