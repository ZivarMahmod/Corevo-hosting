import { decideMotiontestRequest } from './motiontest-request-boundary.mjs'

export function createMotiontestWorker(openNextWorker) {
  if (!openNextWorker || typeof openNextWorker.fetch !== 'function') {
    throw new TypeError('motiontest Worker requires the OpenNext fetch handler')
  }

  return {
    async fetch(request, env, context) {
      const url = new URL(request.url)
      const headerAuthority = request.headers.get('host')
      if (headerAuthority && headerAuthority.toLowerCase() !== url.host.toLowerCase()) {
        return new Response(null, { status: 404 })
      }
      const decision = decideMotiontestRequest({
        authority: headerAuthority ?? url.host,
        method: request.method,
        pathname: url.pathname,
        protocol: url.protocol,
        search: url.searchParams,
      })
      if (decision.action !== 'allow') {
        return new Response(null, {
          status: decision.action === 'deny' ? decision.status : 404,
          headers: decision.action === 'deny' && decision.allow ? { allow: decision.allow } : {},
        })
      }
      const response = await openNextWorker.fetch(request, env, context)
      const isolated = new Response(response.body, response)
      isolated.headers.set('x-robots-tag', 'noindex, nofollow, noarchive')
      return isolated
    },
  }
}
