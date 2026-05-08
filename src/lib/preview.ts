// Cloudflare-friendly preview library: composition files are bundled at build
// time via Vite's `import.meta.glob` so we never need `node:fs` at runtime.
//
// Composition layout: public/compositions/vercel-intro/**

import { dirname, extname, join, normalize } from 'pathe'

export const PREVIEW_BASE_PATH = '/api/preview/'
export const HYPERFRAMES_RUNTIME_URL = '/api/runtime.js'
export const PREVIEW_COMPOSITION_NAME = 'vercel-intro'

const HTML_CONTENT_TYPE = 'text/html; charset=utf-8'
const CONTENT_TYPES = new Map<string, string>([
  ['.html', HTML_CONTENT_TYPE],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.wav', 'audio/wav'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

export class PreviewNotFoundError extends Error {
  constructor(path: string) {
    super(`Preview file not found: ${path}`)
  }
}

export const PREVIEW_RUNTIME_ALIASES = [
  'hyperframe-runtime.js',
  'hyperframe.runtime.iife.js',
] as const

export function isPreviewRuntimeAliasPath(path: string): boolean {
  return (PREVIEW_RUNTIME_ALIASES as readonly string[]).includes(path)
}

// Vite glob: text files come back as strings, binary assets as URLs.
const textFiles = import.meta.glob(
  '/public/compositions/vercel-intro/**/*.{html,css,js,json,svg}',
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

const binaryFiles = import.meta.glob(
  '/public/compositions/vercel-intro/**/*.{png,jpg,jpeg,webp,gif,wav,mp3,mp4,woff,woff2}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

const PREFIX = '/public/compositions/vercel-intro/'

function relKey(path: string): string {
  const normalized = normalize(path).replaceAll('\\', '/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized === '.' ||
    normalized.startsWith('../')
  ) {
    throw new Error(`Invalid preview path: ${path}`)
  }
  return PREFIX + normalized
}

function lookup(path: string): { kind: 'text'; body: string } | { kind: 'url'; body: string } {
  const key = relKey(path)
  if (key in textFiles) return { kind: 'text', body: textFiles[key]! }
  if (key in binaryFiles) return { kind: 'url', body: binaryFiles[key]! }
  throw new PreviewNotFoundError(path)
}

function normalizePreviewHtml(html: string): string {
  let nextHtml = html.replace(/<script[^>]*hyperframe\.runtime[^>]*><\/script>/g, '')
  if (!nextHtml.includes('<base')) {
    nextHtml = nextHtml.replace(/<head>/i, `<head><base href="${PREVIEW_BASE_PATH}">`)
  }

  const runtimeTag = `<script data-hyperframes-preview-runtime="1" src="${HYPERFRAMES_RUNTIME_URL}"></script>`
  if (nextHtml.includes('</body>')) {
    nextHtml = nextHtml.replace('</body>', `${runtimeTag}\n</body>`)
  } else if (nextHtml.includes('</head>')) {
    nextHtml = nextHtml.replace('</head>', `${runtimeTag}\n</head>`)
  } else {
    nextHtml += runtimeTag
  }

  return nextHtml
}

function rewriteRelativeUrl(url: string, compPath: string): string {
  if (
    !url ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('//') ||
    url.startsWith('data:') ||
    url.startsWith('#') ||
    url.startsWith('/')
  ) {
    return url
  }

  const rewritten = normalize(join(dirname(compPath), url)).replaceAll('\\', '/')
  return rewritten.startsWith('./') ? rewritten.slice(2) : rewritten
}

function rewriteSubCompositionPaths(content: string, compPath: string): string {
  const attrPattern = /\b(src|href)=["']([^"'#][^"']*)["']/gi
  const styleUrlPattern = /url\((['"]?)([^'")]+)\1\)/gi

  return content
    .replace(attrPattern, (_match, attr: string, value: string) => {
      return `${attr}="${rewriteRelativeUrl(value, compPath)}"`
    })
    .replace(styleUrlPattern, (_match, quote: string, value: string) => {
      const rewritten = rewriteRelativeUrl(value, compPath)
      return `url(${quote}${rewritten}${quote})`
    })
}

export async function getPreviewHtml(): Promise<string> {
  const file = lookup('index.html')
  if (file.kind !== 'text') throw new Error('index.html not text')
  return normalizePreviewHtml(file.body)
}

export async function getCompositionPreviewHtml(path: string): Promise<string> {
  const file = lookup(path)
  if (file.kind !== 'text') throw new PreviewNotFoundError(path)
  const rawComp = file.body
  const templateMatch = rawComp.match(/<template[^>]*>([\s\S]*)<\/template>/i)
  const content = templateMatch?.[1] ?? rawComp
  const rewrittenContent = rewriteSubCompositionPaths(content, path)

  const indexFile = lookup('index.html')
  if (indexFile.kind !== 'text') throw new Error('index.html not text')
  const indexHtml = indexFile.body
  const headMatch = indexHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  let headContent = headMatch?.[1] ?? ''

  if (!headContent.includes('<base')) {
    headContent = `<base href="${PREVIEW_BASE_PATH}">\n${headContent}`
  }
  if (
    !headContent.includes('hyperframe.runtime') &&
    !headContent.includes('hyperframes-preview-runtime')
  ) {
    headContent += `\n<script data-hyperframes-preview-runtime="1" src="${HYPERFRAMES_RUNTIME_URL}"></script>`
  }
  if (!headContent.includes('gsap')) {
    headContent += '\n<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>'
  }

  return `<!DOCTYPE html>
<html>
<head>
${headContent}
</head>
<body>
<script>window.__timelines=window.__timelines||{};</script>
${rewrittenContent}
</body>
</html>`
}

export async function getPreviewFile(path: string): Promise<
  | { kind: 'text'; body: string; contentType: string }
  | { kind: 'url'; url: string; contentType: string }
> {
  const ext = extname(path).toLowerCase()
  const contentType = CONTENT_TYPES.get(ext) ?? 'application/octet-stream'

  const found = lookup(path)
  if (found.kind === 'text') {
    return { kind: 'text', body: found.body, contentType }
  }
  return { kind: 'url', url: found.body, contentType }
}

export function isPreviewNotFoundError(error: unknown): error is PreviewNotFoundError {
  return error instanceof PreviewNotFoundError
}
