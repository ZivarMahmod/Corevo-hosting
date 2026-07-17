const INTERNAL_ORIGIN = 'https://internal.invalid'
const UNSAFE_PATH_CHARACTER = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\\]/
const MAX_DECODE_PASSES = 4

function hasUnsafeVariant(value: string) {
  let candidate = value

  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    if (candidate.startsWith('//') || UNSAFE_PATH_CHARACTER.test(candidate)) return true

    let decoded: string
    try {
      decoded = decodeURIComponent(candidate)
    } catch {
      return true
    }

    if (decoded === candidate) return false
    candidate = decoded
  }

  // Fail closed when nested encoding still has not converged.
  return true
}

export function safeInternalRedirectPath(value: string | null | undefined): string | null {
  if (!value?.startsWith('/') || hasUnsafeVariant(value)) return null

  try {
    const target = new URL(value, INTERNAL_ORIGIN)
    if (
      target.origin !== INTERNAL_ORIGIN ||
      !target.pathname.startsWith('/') ||
      target.pathname.startsWith('//')
    ) {
      return null
    }
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return null
  }
}
