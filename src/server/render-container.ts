import { Container } from '@cloudflare/containers'

// Mirrors hyperframes-cloudflare-template/src/container.ts. Wires the
// RenderContainer Durable Object to the OCI image defined by `./Dockerfile`.
export class RenderContainer extends Container {
  defaultPort = 8080
  sleepAfter = '10m'
  manualStart = false
}
