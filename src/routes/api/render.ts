import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { getContainer } from '@cloudflare/containers'
import { loadCompositionFiles } from '#/lib/render'

// Mirrors hyperframes-cloudflare-template's /api/render handler:
//   1. Bundle composition files (base64-encoded) into a JSON payload
//   2. POST to the RenderContainer DO (Chromium + ffmpeg + hyperframes)
//   3. Stream the MP4 response into R2
//   4. Return a public URL pointing at /r/<key>

export const Route = createFileRoute('/api/render')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const t0 = Date.now()

        let files
        try {
          files = await loadCompositionFiles(new URL(request.url).origin)
        } catch (err) {
          return jsonError(`failed to load composition: ${msg(err)}`, 500)
        }

        const container = getContainer(env.RENDER_CONTAINER, 'renderer')

        let containerRes: Response
        try {
          containerRes = await container.fetch(
            new Request('http://container/render', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ files }),
            }),
          )
        } catch (err) {
          return jsonError(`container unavailable: ${msg(err)}`, 502)
        }

        if (!containerRes.ok || !containerRes.body) {
          const body = await containerRes.text().catch(() => '')
          return jsonError(`render failed (${containerRes.status}): ${body}`, 502)
        }

        const key = `renders/${Date.now()}-${crypto.randomUUID()}.mp4`
        await env.RENDERS.put(key, containerRes.body, {
          httpMetadata: { contentType: 'video/mp4' },
        })

        const url = new URL(request.url)
        url.pathname = `/r/${key}`

        return Response.json({
          url: url.toString(),
          key,
          durationMs: Date.now() - t0,
        })
      },
    },
  },
})

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
