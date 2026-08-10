const SYSTEM_ENV_KEYS = [
  'CI',
  'COMSPEC',
  'ComSpec',
  'GITHUB_ACTIONS',
  'PATH',
  'Path',
  'PATHEXT',
  'RUNNER_TEMP',
  'SystemRoot',
  'TEMP',
  'TMP',
]

export function motiontestSystemEnvironment(source) {
  const environment = {}
  for (const key of SYSTEM_ENV_KEYS) {
    if (key in source) environment[key] = source[key]
  }
  return environment
}
