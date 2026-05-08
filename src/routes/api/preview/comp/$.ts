import { createFileRoute } from '@tanstack/react-router'
import {
  getCompositionPreviewHtml,
  isPreviewNotFoundError,
} from '#/lib/preview'

export const Route = createFileRoute('/api/preview/comp/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? ''
        try {
          const html = await getCompositionPreviewHtml(path)
          return new Response(html, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
              'Content-Security-Policy': "frame-ancestors 'self'; object-src 'none'",
            },
          })
        } catch (error) {
          if (isPreviewNotFoundError(error)) {
            return new Response('Not found', { status: 404 })
          }
          return new Response(
            error instanceof Error ? error.message : 'Preview error',
            { status: 400 },
          )
        }
      },
    },
  },
})
