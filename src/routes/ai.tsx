import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

// Server function — wired so a real `@tanstack/ai` adapter (Anthropic, OpenAI,
// Gemini, Ollama, etc.) can be dropped in. To swap in Anthropic for example:
//
//   import { chat } from '@tanstack/ai'
//   import { anthropicText } from '@tanstack/ai-anthropic'
//   const stream = chat({
//     model: anthropicText('claude-sonnet-4-6'),
//     messages: [{ role: 'user', content: prompt }],
//   })
//
// For now we return a deterministic mock so the UI works without an API key.
const askAi = createServerFn({ method: 'POST' })
  .inputValidator((d: { prompt: string }) => d)
  .handler(async ({ data }) => {
    if (!data.prompt.trim()) {
      throw new Error('Prompt is required')
    }
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return {
        provider: 'mock',
        text: `(no ANTHROPIC_API_KEY set — returning a stub) You asked: "${data.prompt}"`,
      }
    }
    // Real implementation would call `chat()` from @tanstack/ai here.
    return {
      provider: 'mock',
      text: `(API key detected; replace this branch with @tanstack/ai's chat()) "${data.prompt}"`,
    }
  })

export const Route = createFileRoute('/ai')({ component: AiDemo })

function AiDemo() {
  const [prompt, setPrompt] = useState('Summarize TanStack Start in one sentence.')
  const ask = useMutation({
    mutationFn: (p: string) => askAi({ data: { prompt: p } }),
  })

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">TanStack AI demo</h1>
        <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
          Server function + TanStack Query mutation. Drop in a{' '}
          <code>@tanstack/ai</code> provider adapter to make it real.
        </p>
      </header>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          ask.mutate(prompt)
        }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="rounded-lg border border-[rgba(23,58,64,0.2)] bg-white/60 p-3 text-sm"
        />
        <button
          type="submit"
          disabled={ask.isPending}
          className="self-start rounded-lg bg-[var(--sea-ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {ask.isPending ? 'Asking…' : 'Ask'}
        </button>
      </form>

      {ask.isSuccess && (
        <pre className="whitespace-pre-wrap rounded-lg bg-black/5 p-4 text-sm">
          {ask.data.text}
        </pre>
      )}
      {ask.isError && (
        <p className="text-sm text-red-500">
          {ask.error instanceof Error ? ask.error.message : 'Request failed'}
        </p>
      )}
    </main>
  )
}
