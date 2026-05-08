import { createFileRoute } from '@tanstack/react-router'
import {
  getPreviewFile,
  isPreviewNotFoundError,
  isPreviewRuntimeAliasPath,
} from '#/lib/preview'

export const Route = createFileRoute('/api/preview/$')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const filePath = params._splat ?? ''

        if (isPreviewRuntimeAliasPath(filePath)) {
          const url = new URL('/api/runtime.js', request.url)
          return Response.redirect(url, 302)
        }

        try {
          const file = await getPreviewFile(filePath)
          if (file.kind === 'text') {
            return new Response(file.body, {
              headers: {
                'Content-Type': file.contentType,
                'Cache-Control': 'no-store',
              },
            })
          }
          // Binary asset: redirect to the bundled URL Vite produced.
          return Response.redirect(new URL(file.url, request.url), 302)
        } catch (error) {
          if (isPreviewNotFoundError(error)) {
            return new Response('Not found', { status: 404 })
          }
          if (error instanceof Error && /Invalid preview path/i.test(error.message)) {
            return new Response('Invalid path', { status: 400 })
          }
          throw error
        }
      },
    },
  },
})
