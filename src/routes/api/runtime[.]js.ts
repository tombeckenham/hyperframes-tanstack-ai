import { createFileRoute } from '@tanstack/react-router'
// `?raw` import inlines the runtime bundle into our build so the route works on
// any runtime (Cloudflare Workers, Node, etc.) without filesystem access.
import runtimeSource from '@hyperframes/core/runtime?raw'

export const Route = createFileRoute('/api/runtime.js')({
  server: {
    handlers: {
      GET: () =>
        new Response(runtimeSource, {
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        }),
    },
  },
})
