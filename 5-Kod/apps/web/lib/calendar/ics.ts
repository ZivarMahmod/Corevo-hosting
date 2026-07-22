const encoder = new TextEncoder()

export function icsEscape(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
}

export function icsUtcStamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('invalid_ics_timestamp')
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function foldIcsLine(line: string): string {
  if (/[\r\n]/.test(line)) throw new Error('invalid_ics_line')

  const parts: string[] = []
  let part = ''
  let bytes = 0
  let limit = 75

  for (const character of line) {
    const size = encoder.encode(character).byteLength
    if (bytes + size > limit && part) {
      parts.push(part)
      part = character
      bytes = size
      limit = 74
    } else {
      part += character
      bytes += size
    }
  }
  parts.push(part)
  return parts.map((value, index) => index === 0 ? value : ` ${value}`).join('\r\n')
}

export function serializeIcs(lines: readonly string[]): string {
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}
