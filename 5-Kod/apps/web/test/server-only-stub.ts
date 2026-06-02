// Vitest stub for the `server-only` package. The real package's default export
// throws unless the bundler applies the `react-server` condition (which vitest's
// node environment does not), so importing any server-only module under test would
// crash. Aliasing `server-only` to this empty module lets us unit-test the real
// transport/brand code paths. Pure side-effect-free no-op.
export {}
