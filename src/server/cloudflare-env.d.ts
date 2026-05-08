// Augments `Cloudflare.Env` (the type of `env` in `cloudflare:workers`) for the
// bindings declared in wrangler.jsonc. A `wrangler types` run will replace
// this with a more accurate, generated equivalent.

import type { RenderContainer } from './render-container'

declare global {
  namespace Cloudflare {
    interface Env {
      RENDER_CONTAINER: DurableObjectNamespace<RenderContainer>
      RENDERS: R2Bucket
      ASSETS?: Fetcher
    }
  }
}

export {}
