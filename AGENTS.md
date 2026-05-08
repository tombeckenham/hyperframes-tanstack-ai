<!-- intent-skills:start -->
## Skill Loading

Before substantial work:
- Skill check: run `npx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# hyperframes-tanstack-ai

Migration of the [hyperframes-vercel-template](https://github.com/heygen-com/hyperframes-vercel-template) Next.js app to **TanStack Start** on **Cloudflare Workers + Containers + R2**, modeled after the [hyperframes-cloudflare-template](https://github.com/heygen-com/hyperframes-cloudflare-template).

## Scaffold history

The project was scaffolded with the TanStack CLI:

```bash
npx @tanstack/cli@latest create my-tanstack-app \
  --agent \
  --deployment cloudflare \
  --add-ons neon,drizzle,sentry,better-auth,tanstack-query
```

After scaffolding the following commands were run:

```bash
npx @tanstack/intent@latest install   # wrote intent-skills block above
npx @tanstack/intent@latest list      # 33 skills across 10 packages
```

`@tanstack/ai` was added afterwards (the CLI does not yet ship it as a built-in
add-on) and demonstrated under `src/routes/ai.tsx`.

## Stack

| Layer        | Choice                                                            |
| ------------ | ----------------------------------------------------------------- |
| Framework    | TanStack Start + TanStack Router                                  |
| Data         | TanStack Query                                                    |
| AI           | TanStack AI (`@tanstack/ai`)                                      |
| Deployment   | Cloudflare Workers + Containers + R2                              |
| Database     | Neon (Postgres) via Drizzle ORM                                   |
| Auth         | Better Auth                                                       |
| Observability| Sentry (`@sentry/tanstackstart-react`)                            |
| Toolchain    | ESLint, TypeScript, Vitest, bun (package manager)                 |
| Code review  | CodeRabbit (GitHub App, `.coderabbit.yaml`)                       |

## Render pipeline (Cloudflare Containers)

The legacy `/api/render` endpoint depended on Vercel-only services
(`@vercel/sandbox` for Chromium+ffmpeg, `@vercel/blob` for storage). Both have
no equivalent on Cloudflare, so the pipeline was rebuilt from
`hyperframes-cloudflare-template`:

```
Browser ──POST /api/render──▶ Worker ──RPC──▶ RenderContainer (Durable Object)
                                  │              ├─ Chromium (chrome-headless-shell)
                                  │              ├─ ffmpeg-static
                                  │              └─ hyperframes CLI
                                  │
                                  └──put MP4──▶ R2 (RENDERS bucket)
                                                ▲
                                                │
                              GET /r/:key ◀─────┘
```

Key files:

- `Dockerfile` + `container/server.mjs` + `container/package.json` — the
  pre-baked OCI image with Chromium libs, ffmpeg, hyperframes CLI, and an HTTP
  server that accepts a JSON `{files:[{path,content:base64}]}` body and
  streams an MP4 back.
- `src/server/render-container.ts` — exports the `RenderContainer` Durable
  Object class (subclass of `@cloudflare/containers` `Container`). Sleeps after
  10 minutes idle.
- `src/server/worker.ts` — Worker entry. Re-exports `RenderContainer` so
  wrangler registers the DO, then defers to TanStack Start's request handler.
- `src/routes/api/render.ts` — POST handler. Bundles composition files via
  `import.meta.glob` (`?raw` for text, `?url` for binaries), POSTs to the
  container, streams the MP4 into R2, returns `{url, key, durationMs}`.
- `src/routes/r/$.ts` — public R2 fetch endpoint. Sets immutable cache
  headers + ETag.
- `wrangler.jsonc` — declares the `RENDER_CONTAINER` DO binding, the `RENDERS`
  R2 bucket, and the migration registering `RenderContainer` as a SQLite class.

## Preview pipeline

The preview routes (`/api/preview`, `/api/preview/$`, `/api/preview/comp/$`,
`/api/runtime.js`) were ported from `lib/preview.ts` to be Cloudflare-friendly:

- No runtime `node:fs` access. Composition files under
  `public/compositions/vercel-intro/**` are bundled at build time via Vite's
  `import.meta.glob` (text inlined as raw strings; binary asset URLs emitted
  by Vite's asset pipeline).
- `/api/runtime.js` inlines `@hyperframes/core/dist/hyperframe.runtime.iife.js`
  via a `?raw` import — no filesystem reads at request time.
- `/api/preview/$` redirects binary asset requests to Vite's emitted URLs (so
  the player still sees them at the same `/api/preview/...` paths it did under
  Next.js).
- The `runtime.js` route file is named `runtime[.]js.ts` — the brackets escape
  the literal dot in TanStack Router's filename-to-path convention.

## Routes

| Path                        | File                                  | Notes                              |
| --------------------------- | ------------------------------------- | ---------------------------------- |
| `/`                         | `src/routes/index.tsx`                | HyperFrames player + Render button |
| `/ai`                       | `src/routes/ai.tsx`                   | TanStack AI demo (server fn + Query) |
| `/about`                    | `src/routes/about.tsx`                | Scaffold default                   |
| `/demo/*`                   | `src/routes/demo/*.tsx`               | Better-auth, Drizzle, Neon, Sentry, Query demos |
| `POST /api/render`          | `src/routes/api/render.ts`            | Container render → R2              |
| `GET /api/preview`          | `src/routes/api/preview/index.ts`     | Bundled preview HTML               |
| `GET /api/preview/*`        | `src/routes/api/preview/$.ts`         | Composition file proxy             |
| `GET /api/preview/comp/*`   | `src/routes/api/preview/comp/$.ts`    | Sub-composition preview            |
| `GET /api/runtime.js`       | `src/routes/api/runtime[.]js.ts`      | Inlined hyperframes runtime        |
| `GET /r/*`                  | `src/routes/r/$.ts`                   | Public R2 fetch (rendered MP4s)    |
| `* /api/auth/*`             | `src/routes/api/auth/$.ts`            | Better Auth handler                |

## Environment

```bash
# .env.local — provided automatically by Neon Launchpad on the first dev run.
DATABASE_URL=
DATABASE_URL_POOLER=

# Optional — for /ai demo to call a real provider.
ANTHROPIC_API_KEY=

# Sentry — set during deploy.
SENTRY_DSN=
```

R2 / RENDER_CONTAINER bindings are configured in `wrangler.jsonc` and become
available via `import { env } from 'cloudflare:workers'` at runtime. They do
NOT need to be set as env vars.

## Scripts

```bash
bun install           # install deps
bun run dev           # vite dev on :3000
bun run lint          # eslint
bun run typecheck     # tsc --noEmit
bun run test          # vitest
bun run build         # vite build (writes .output/server)
bun run deploy        # build + wrangler deploy (Workers + Containers + R2)
bun run db:push       # push drizzle schema to Neon
```

## Partner integrations

| Partner       | Status                | Where                                                  |
| ------------- | --------------------- | ------------------------------------------------------ |
| Cloudflare    | ✅ wired               | `wrangler.jsonc`, `Dockerfile`, `src/server/*`         |
| Neon          | ✅ wired (via CLI)     | `neon-vite-plugin.ts`, `src/db/`, `drizzle.config.ts`  |
| Drizzle       | ✅ wired (via CLI)     | `drizzle.config.ts`, `src/db/schema.ts`                |
| Sentry        | ✅ wired (via CLI)     | `instrument.server.mjs`                                |
| Better Auth   | ✅ wired (via CLI)     | `src/lib/auth.ts`, `src/routes/api/auth/$.ts`          |
| TanStack Query| ✅ wired (via CLI)     | `src/integrations/tanstack-query/*`                    |
| TanStack AI   | ✅ wired (post-CLI)    | `src/routes/ai.tsx`                                    |
| CodeRabbit    | ✅ config              | `.coderabbit.yaml` — install GH App separately         |

### CodeRabbit setup

CodeRabbit is repo tooling, not in-app code:

1. Install the [CodeRabbit GitHub App](https://github.com/marketplace/coderabbitai) on the repo.
2. The app reads `.coderabbit.yaml` from each PR's base branch.
3. PRs against `main` / `develop` get automatic reviews; `legacy-source/**` is
   excluded.

## Migration notes

- The legacy app lives in `./legacy-source` (cloned, not committed). It is
  reference material only — the migration is a rewrite, not an in-place port.
- `lib/preview.ts` was rewritten (now `src/lib/preview.ts`) to drop runtime
  `node:fs` in favor of Vite globs, so the same code runs on Workers.
- `lib/sandbox.ts` was replaced by the Cloudflare Container pipeline above —
  the file is preserved in `legacy-source/lib/sandbox.ts` for reference.
- The legacy `app/page.module.css` was dropped; styling moved to Tailwind v4.
- The dev script uses `dotenv -e .env.local` to keep the legacy `.env.local`
  pattern working.

## Known gotchas

- `bun install` requires `--legacy-peer-deps` semantics implicitly because
  `vite-plugin-neon-new` peers on `vite@^6||^7` while we run vite@^8. Bun
  resolves this without the flag; if you switch back to npm, pass
  `--legacy-peer-deps`.
- TanStack Router files with literal dots in the URL must escape via brackets:
  `runtime[.]js.ts` → `/api/runtime.js`.
- Cloudflare Containers bills per-10ms when warm. The container sleeps after
  10 minutes idle (configurable in `src/server/render-container.ts`).
- Cloudflare Workers Paid plan is required for Containers.

## Next steps

- [ ] Run `wrangler types` once on a workstation with wrangler logged in to
      generate `worker-configuration.d.ts` (the hand-written
      `src/server/cloudflare-env.d.ts` is a placeholder).
- [ ] Add a Vitest suite for `src/lib/preview.ts` (port `lib/preview.test.ts`).
- [ ] Wire `@tanstack/ai-anthropic` into `src/routes/ai.tsx` once an
      `ANTHROPIC_API_KEY` is provisioned.
- [ ] Add a CI workflow (GitHub Actions) running `lint`, `typecheck`, and
      `vitest` on PRs — CodeRabbit will review on top.
- [ ] Provision Neon and run `bun run db:push` to materialize the Better Auth
      schema, then exercise `/demo/better-auth`.
