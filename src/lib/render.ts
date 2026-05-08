// Composition-loading helpers for the /api/render endpoint. We bundle the
// composition files at build time via Vite's `import.meta.glob` (text as raw
// string, binary as URL) so the Worker doesn't need filesystem access.

const PREFIX = '/public/compositions/vercel-intro/'

const textGlob = import.meta.glob(
  '/public/compositions/vercel-intro/**/*.{html,css,js,json,svg}',
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

const binaryGlob = import.meta.glob(
  '/public/compositions/vercel-intro/**/*.{png,jpg,jpeg,webp,gif,wav,mp3,mp4,woff,woff2}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text))
}

export interface CompositionFile {
  path: string
  content: string // base64
}

export async function loadCompositionFiles(
  origin: string,
): Promise<CompositionFile[]> {
  const out: CompositionFile[] = []
  for (const [key, body] of Object.entries(textGlob)) {
    out.push({ path: key.slice(PREFIX.length), content: textToBase64(body) })
  }
  for (const [key, url] of Object.entries(binaryGlob)) {
    // Vite-emitted URLs are root-relative; resolve against the request origin
    // so the Worker can fetch them via the ASSETS binding (or whatever Vite's
    // dev server is serving).
    const res = await fetch(new URL(url, origin))
    if (!res.ok) {
      throw new Error(`asset fetch failed: ${url} (${res.status})`)
    }
    const buf = new Uint8Array(await res.arrayBuffer())
    out.push({ path: key.slice(PREFIX.length), content: bytesToBase64(buf) })
  }
  return out
}
