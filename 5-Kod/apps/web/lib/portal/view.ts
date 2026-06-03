/**
 * Pure persistence helper for the back-office ViewSwitcher (playbook — Bokningar
 * Lista/Vecka/…). Extracted from the usePersistentView hook so the read+validate
 * logic is unit-testable in the node vitest env (the hook itself needs a DOM).
 *
 * Given whatever came out of localStorage (possibly null / stale / tampered),
 * return it only if it's one of the currently-valid view keys; otherwise fall
 * back. This is what guards the operator from landing on a removed view after a
 * page's view set changes (e.g. Tidslinje/Tavla were dropped from Bokningar).
 */
export function pickPersistedView<T extends string>(
  saved: string | null | undefined,
  valid: ReadonlyArray<T>,
  fallback: T,
): T {
  if (saved && (valid as ReadonlyArray<string>).includes(saved)) {
    return saved as T
  }
  return fallback
}
