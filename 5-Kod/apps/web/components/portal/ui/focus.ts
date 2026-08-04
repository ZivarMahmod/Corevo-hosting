const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]):not([aria-disabled="true"]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => {
    if (
      element.tabIndex < 0 ||
      element.matches(':disabled') ||
      element.getAttribute('aria-disabled') === 'true' ||
      element.closest('[hidden],[inert],[aria-hidden="true"]')
    ) {
      return false
    }
    const style = window.getComputedStyle(element)
    return (
      style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
    )
  })
}

export function trapTab(event: KeyboardEvent, container: HTMLElement): boolean {
  if (event.key !== 'Tab') return false

  const focusable = getFocusableElements(container)
  const first = focusable[0]
  const last = focusable.at(-1)
  const activeOutside = !container.contains(document.activeElement)
  const target =
    !first || !last
      ? container
      : activeOutside
        ? event.shiftKey
          ? last
          : first
        : event.shiftKey && document.activeElement === first
          ? last
          : !event.shiftKey && document.activeElement === last
            ? first
            : null

  if (!target) return false
  event.preventDefault()
  target.focus()
  return true
}
