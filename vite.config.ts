import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig(({ command }) => {
  const isDev = command === 'serve'

  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      cloudflare({
        viteEnvironment: { name: 'ssr' },
        // Strip the RenderContainer + DO + R2 bindings from the local dev
        // config so the Cloudflare plugin doesn't try to build/start the
        // container in Docker. Production uses wrangler.jsonc as-is.
        // Calls to /api/render will fail at runtime in dev — that's expected;
        // run against deployed workers via `wrangler dev --remote` to test.
        config: isDev
          ? (cfg) => {
              const c = cfg as Record<string, unknown>
              delete c.containers
              delete c.durable_objects
              delete c.migrations
              delete c.r2_buckets
            }
          : undefined,
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})
