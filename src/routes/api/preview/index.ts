import { createFileRoute } from '@tanstack/react-router'
import { getPreviewHtml } from '#/lib/preview'

export const Route = createFileRoute('/api/preview/')({
  server: {
    handlers: {
      GET: async () => {
        const html = await getPreviewHtml()
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'Content-Security-Policy': "frame-ancestors 'self'; object-src 'none'",
          },
        })
      },
    },
  },
})
