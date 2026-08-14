# itsmateo.wtf

Personal site for Matthew "Mateo" Meakin.

- Static wiki entry (HTML/CSS/JS, no framework)
- Hono server serving the static files + a single `POST /api/chat` endpoint backed by OpenAI for the on-demand AI Q&A

## Local dev

```
npm install
OPENAI_API_KEY=sk-... npm run dev
# → http://localhost:8080
```

## Deploy (Railway)

Nixpacks auto-detects Node from `package.json` and runs `npm start`.

**Required env var** (set in Railway dashboard → Variables):

| Key | Value |
|-----|-------|
| `OPENAI_API_KEY` | your OpenAI key |

Optional:

| Key | Default | Notes |
|-----|---------|-------|
| `OPENAI_MODEL` | `gpt-4o-mini` | Override if you want a different model |
| `PORT` | `8080` | Railway injects this automatically |

Without `OPENAI_API_KEY` the site still serves; only the "Just curious" chat path returns a friendly fallback pointing to `mateo@basemate.app`.

## Architecture

```
Browser ──GET /*────────── server.js (Hono) ─── ./ (static files)
        ──POST /api/chat ─→                  ─── OpenAI SDK
```

- Rate limit: 10 requests per IP per hour (in-memory sliding window)
- Input cap: 1000 chars
- Max output: 800 tokens

## Files

- [`index.html`](index.html) — the wiki entry + minimal hero card
- [`site.css`](site.css) — all styles
- [`site.js`](site.js) — chat state machine (BUILD / HIRE / RECOVERY / QA flows)
- [`server.js`](server.js) — Hono server + Anthropic call
- [`resume.html`](resume.html) — print-friendly resume
- [`resume.pdf`](resume.pdf) — one-page exportable PDF
