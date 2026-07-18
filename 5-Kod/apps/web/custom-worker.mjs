// OpenNext generates this module during build. The wrapper keeps its fetch
// handler and adds the platform-owned reminder scheduler; it never dispatches a
// notification provider. The route only records durable outbox events.
// @ts-ignore generated at build time
import handler from './.open-next/worker.js'

import { runPrimaryScheduler } from './scripts/primary-scheduler.mjs'

export default {
  fetch: handler.fetch,

  async scheduled(_event, env, ctx) {
    await runPrimaryScheduler({
      env,
      appFetch: (request) => handler.fetch(request, env, ctx),
    })
  },
}
