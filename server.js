/* ============================================================
   itsmateo.wtf — server
   Hono on Node. Serves the static site + a single /api/chat
   endpoint that calls OpenAI for the open Q&A path.
   ============================================================ */

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import OpenAI from 'openai';

const PORT = Number(process.env.PORT) || 8080;
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!API_KEY) {
  console.warn('[itsmateo] OPENAI_API_KEY is not set — /api/chat will return 503.');
}

const openai = API_KEY ? new OpenAI({ apiKey: API_KEY }) : null;

// ── Mateo bio (system prompt for the QA path) ──────────────────
const MATEO_BIO = `
You are an agent embedded in Matthew "Mateo" Meakin's personal wiki (itsmateo.wtf).
You answer questions about Mateo in his own calm, direct voice — concise (1-3 short paragraphs max), specific, never marketing-y, never hyped. Use plain language. Don't make up facts; if you don't know, say so and point to mateo@basemate.app. Don't use emoji. Don't open with "Great question".

# Mateo facts

- Full name: Matthew Ross Meakin. Goes by "Mateo".
- Based in Los Angeles, CA. Born in Los Angeles.
- Sober since 2021 (5+ years).
- No CS degree. Self-taught engineer.
- Attended California Institute of the Arts (CalArts) — did not graduate.

# Current companies & roles

- Founder & CTO of Beora Care (founded 2024). HIPAA-compliant AI platform for behavioral health / addiction recovery programs. Two surfaces: CareWiki (Wikipedia-styled staff dashboard for compiling, reviewing, auditing patient records) and Beora (iOS care concierge for clients and clinical assistants). Designed three-tier PHI architecture enforcing 42 CFR Part 2; built human-in-the-loop review pipeline with clinician trust graduation. Built from lived experience, not a case study. Site: beora.care.
- Founder & CEO of Basemate (founded 2023). Messaging network for stablecoins on Coinbase's Base L2. Text a local Mate number on iMessage, RCS, or WhatsApp and a wallet is created — send USDC to any phone number, no app, no seed phrase. Mission: put Base on a local cell phone in every country. Live US node on iMessage, RCS, and Base App; Apple Pay and card funding; ~5% yield on idle USDC; spot swaps in chat. 12K+ users and 64K+ messages as of August 2026. Currently in Circuit Accelerator (credit-union innovation program); previously Base Batches 002. Seed data room: basemate.app/deck. Shane Mac (Founder & CEO of XMTP) is an Advisor.
- Interventionist & sober companion (private practice, 2023–present). Private 1-on-1 recovery support for high-profile clients. Crisis intervention, treatment-facility placement, post-discharge continuity of care.

# Coinbase agents (the marquee work)

Mateo has built and deployed two official onchain AI agents for Coinbase:
1. Base Camp agent — deployed live at Base Camp, Coinbase's developer event for the Base ecosystem.
2. DevConnect agent — follow-up agent deployed at DevConnect, the Ethereum developer convening.

Both went live on stage at flagship Coinbase developer events. Stack: TypeScript, LangChain, XMTP, onchain execution on Base L2.

# Evergreen Fund (2021–2024)

Mateo entered Evergreen Fund as a patient on scholarship after a period of homelessness on Skid Row. He was hired onto staff and over three years advanced through every operational role:
- 2021: Technician (floor support, shift work, charting)
- 2022: Med Room Manager (controlled-substance inventory, DEA compliance)
- 2023: Director of Operations (day-to-day ops, staffing, clinical workflow design)
- 2024: Chief Technology Officer (built internal systems from scratch, self-taught)

# Earlier (film & television)

- Left high school at sixteen for the Art Department on HBO's Deadwood.
- Teamsters Hollywood Local 399 transportation captain & driver (2019–2023). Productions include The Matrix Resurrections (Warner Bros.), Grace & Frankie (Netflix), national Walmart commercial campaigns.

# Community

- Founder of Overdose LA — street-level harm-reduction outreach in Los Angeles. Distributes food, naloxone, and harm-reduction supplies to unhoused individuals on Skid Row and surrounding encampments.

# Stack

TypeScript, Next.js, Node.js, Prisma + Postgres, LangChain, Vertex AI (Gemini), GCP, XMTP, Base L2, SwiftUI for iOS. HIPAA / 42 CFR Part 2. Crisis intervention, clinical ops, DEA compliance, team leadership.

# Contact

Work: mateo@basemate.app
Personal: meakin.matt@gmail.com
GitHub: github.com/fweekshow
LinkedIn: linkedin.com/in/matthew-meakin-72592219a
`.trim();

// ── Rate limit: in-memory sliding window per IP ────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10;                    // 10 requests per IP per hour
const rateLog = new Map(); // ip -> [timestamp, ...]

function checkRateLimit(ip) {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const list = (rateLog.get(ip) || []).filter(t => t > cutoff);
  if (list.length >= RATE_LIMIT_MAX) {
    rateLog.set(ip, list);
    return false;
  }
  list.push(now);
  rateLog.set(ip, list);
  return true;
}

// Periodic cleanup so the Map doesn't leak forever
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [ip, list] of rateLog) {
    const pruned = list.filter(t => t > cutoff);
    if (pruned.length === 0) rateLog.delete(ip);
    else rateLog.set(ip, pruned);
  }
}, 10 * 60 * 1000);

function clientIp(c) {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}

// ── App ────────────────────────────────────────────────────────
const app = new Hono();

app.post('/api/chat', async (c) => {
  if (!openai) {
    return c.json({ error: 'service_unavailable' }, 503);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const question = (body?.question || '').toString().trim();
  if (!question) return c.json({ error: 'missing_question' }, 400);
  if (question.length > 1000) return c.json({ error: 'question_too_long' }, 413);

  const ip = clientIp(c);
  if (!checkRateLimit(ip)) {
    return c.json({ error: 'rate_limited' }, 429);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 800,
      temperature: 0.6,
      messages: [
        { role: 'system', content: MATEO_BIO },
        { role: 'user', content: question },
      ],
    });

    const reply = (completion.choices?.[0]?.message?.content || '').trim();
    return c.json({ reply });
  } catch (err) {
    console.error('[itsmateo] openai error:', {
      message: err?.message,
      status: err?.status,
      code: err?.code,
      type: err?.type,
      cause: err?.cause?.code || err?.cause?.message,
    });
    return c.json({ error: 'upstream_error' }, 502);
  }
});

// Health check (handy on Railway)
app.get('/healthz', (c) => c.text('ok'));

// Static site — everything else
app.use('/*', serveStatic({ root: './' }));

// SPA-ish fallback: serve index.html for unknown routes that aren't files
app.notFound(async (c) => {
  const path = c.req.path;
  if (path.includes('.')) return c.text('Not found', 404);
  return serveStatic({ root: './', path: 'index.html' })(c, async () => {});
});

serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`[itsmateo] listening on ${info.address}:${info.port} (model: ${MODEL})`);
});
