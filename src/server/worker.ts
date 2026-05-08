// Cloudflare Workers entry. Wraps TanStack Start's default fetch handler so we
// can also export the `RenderContainer` Durable Object class — wrangler picks
// up exported DO classes by name (see wrangler.jsonc `durable_objects`).
import startEntry from '@tanstack/react-start/server-entry'

export { RenderContainer } from './render-container'
export default startEntry
