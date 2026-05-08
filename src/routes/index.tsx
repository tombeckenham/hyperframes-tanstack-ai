import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

const COMPOSITION_SRC = '/api/preview'
const COMPOSITION_WIDTH = 1920
const COMPOSITION_HEIGHT = 1080

type HyperframesPlayerElement = HTMLElement & {
  pause?: () => void
  currentTime?: number
}

export const Route = createFileRoute('/')({ component: Home })

async function postRender(): Promise<{ url: string }> {
  const res = await fetch('/api/render', { method: 'POST' })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `Render failed (${res.status})`)
  }
  return (await res.json()) as { url: string }
}

function Home() {
  const [playerLoaded, setPlayerLoaded] = useState(false)
  const playerRef = useRef<HyperframesPlayerElement | null>(null)

  const render = useMutation({
    mutationFn: postRender,
  })

  useEffect(() => {
    let cancelled = false

    import('@hyperframes/player').then(() => {
      if (!cancelled) setPlayerLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!playerLoaded) return
    const player = playerRef.current
    if (!player) return

    const syncInitialState = () => {
      player.pause?.()
      if (typeof player.currentTime === 'number') {
        player.currentTime = 0
      }
    }

    syncInitialState()
    player.addEventListener('ready', syncInitialState)
    return () => {
      player.removeEventListener('ready', syncInitialState)
    }
  }, [playerLoaded])

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-8 px-6 pb-16 pt-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          HyperFrames on TanStack Start
        </h1>
        <p className="mt-2 max-w-[640px] text-[var(--sea-ink-soft)]">
          HTML-based video compositions — previewed in the browser, rendered
          server-side. Migrated from Next.js to TanStack Start, deployed to
          Cloudflare Workers.
        </p>
      </header>

      <section
        className="w-full overflow-hidden rounded-xl bg-black"
        style={{ aspectRatio: `${COMPOSITION_WIDTH} / ${COMPOSITION_HEIGHT}` }}
      >
        {playerLoaded && (
          // @ts-expect-error — custom element from @hyperframes/player
          <hyperframes-player
            ref={playerRef}
            src={COMPOSITION_SRC}
            width={COMPOSITION_WIDTH}
            height={COMPOSITION_HEIGHT}
            controls
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        )}
      </section>

      <section className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="rounded-lg bg-[var(--sea-ink)] px-5 py-2.5 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => render.mutate()}
          disabled={render.isPending}
        >
          {render.isPending ? 'Rendering…' : 'Render MP4'}
        </button>

        {render.isPending && (
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Spinning up the renderer. (See AGENTS.md — Cloudflare-native render
            backend is a follow-up.)
          </p>
        )}
        {render.isSuccess && (
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Done —{' '}
            <a
              href={render.data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              open MP4
            </a>
          </p>
        )}
        {render.isError && (
          <p className="text-sm text-red-500">
            {render.error instanceof Error ? render.error.message : 'Render failed'}
          </p>
        )}
      </section>

      <footer className="flex gap-3 text-sm text-[var(--sea-ink-soft)]">
        <a
          href="https://github.com/heygen-com/hyperframes"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          HyperFrames on GitHub
        </a>
        <span>·</span>
        <a
          href="https://hyperframes.heygen.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Docs
        </a>
        <span>·</span>
        <a href="/ai" className="underline">
          TanStack AI demo
        </a>
      </footer>
    </main>
  )
}
