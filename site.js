/* ============================================================
   itsmateo.wtf — site script
   - Live clock + last edited
   - Article statistics (computed from DOM)
   - Agent demo with two modes:
       1. Q&A mode (default)  — answers about Mateo's bio
       2. Office hours mode   — scopes a project, drives to contact
   - Triggers for office-hours mode: user-clicked CTA or detected
     intent words ("build", "hire", "work with", "scope", "project"...)
   ============================================================ */

// ── Bio context for the agent. Tight. Will inject into prompts. ──
const MATEO_BIO = `
You are an agent embedded in Matthew "Mateo" Meakin's personal wiki (itsmateo.wtf).
You answer questions about Mateo in his own calm, direct voice — concise (1-3 short paragraphs max), specific, never marketing-y, never hyped. Use plain language. Don't make up facts; if you don't know, say so and point to mattm@beora.ai.

# Mateo facts

- Full name: Matthew Ross Meakin. Goes by "Mateo".
- Based in Los Angeles, CA. Born in Los Angeles.
- Sober since 2021 (5+ years).
- No CS degree. Self-taught engineer.
- Attended California Institute of the Arts (CalArts) — did not graduate.

# Current companies & roles

- **Founder & CTO of Beora Care** (founded 2024). HIPAA-compliant AI platform for behavioral health / addiction recovery programs. Two surfaces: CareWiki (Wikipedia-styled staff dashboard for compiling, reviewing, auditing patient records) and Beora (iOS care concierge for clients and clinical assistants). Designed three-tier PHI architecture enforcing 42 CFR Part 2; built human-in-the-loop review pipeline with clinician trust graduation. Built from lived experience, not a case study. Site: beora.care.
- **Founder of Basemate** (founded 2023). Tooling for onchain developers on Coinbase's Base L2 network. Accepted into Base Batches 002, Coinbase's onchain startup accelerator. Site: basemate.app.
  - Shane Mac (Founder & CEO of XMTP) is an Advisor on Basemate.
- **Interventionist & sober companion** (private practice, 2023–present). Private 1-on-1 recovery support for high-profile clients. Crisis intervention, treatment-facility placement, post-discharge continuity of care.

# Coinbase agents (the marquee work)

Mateo has built and deployed two official onchain AI agents for Coinbase:
1. **Base Camp agent** — Built for and deployed live at Base Camp, Coinbase's developer event for the Base ecosystem.
2. **DevConnect agent** — Follow-up agent deployed at DevConnect, the Ethereum developer convening.

Both went live on stage at flagship Coinbase developer events. Stack: TypeScript, LangChain, XMTP, onchain execution on Base L2.

# Evergreen Fund (2021–2024)

Mateo entered Evergreen Fund as a patient on scholarship after a period of homelessness on Skid Row. He was hired onto staff and over three years advanced through every operational role:
- 2021: Technician (floor support, shift work, charting)
- 2022: Med Room Manager (controlled-substance inventory, DEA compliance)
- 2023: Director of Operations (day-to-day ops, staffing, clinical workflow design)
- 2024: Chief Technology Officer (built internal systems from scratch, self-taught)

# Earlier (film & television)

- Left high school at sixteen for the Art Department on HBO's *Deadwood*.
- Teamsters Hollywood Local 399 transportation captain & driver (2019–2023). Productions include The Matrix Resurrections (Warner Bros.), Grace & Frankie (Netflix), national Walmart commercial campaigns.

# Community

- **Founder of Overdose LA** — street-level harm-reduction outreach in Los Angeles. Distributes food, naloxone, and harm-reduction supplies to unhoused individuals on Skid Row and surrounding encampments.

# Stack

TypeScript, Next.js, Node.js, Prisma + Postgres, LangChain, Vertex AI (Gemini), GCP, XMTP, Base L2, SwiftUI for iOS. HIPAA / 42 CFR Part 2. Crisis intervention, clinical ops, DEA compliance, team leadership.

# Contact

Work: mattm@beora.ai
Personal: meakin.matt@gmail.com
GitHub: github.com/fweekshow
LinkedIn: linkedin.com/in/matthew-meakin-72592219a
`.trim();

// ── Office hours flow steps ──
// Each step: a question Mateo's agent asks, plus a key under which to store the answer.
const OFFICE_HOURS_STEPS = [
  {
    key: 'project',
    prompt: "Tell me what you're building or what you're trying to figure out. A sentence or two is plenty.",
    placeholder: "e.g. an AI agent for our clinic's intake process",
  },
  {
    key: 'stage',
    prompt: "Where are you in it? Idea, prototype, shipping, or scaling?",
    placeholder: "e.g. we have a v1 in production, ~50 active users",
  },
  {
    key: 'help',
    prompt: "Where do you most want Mateo's input? Engineering, agent design, clinical / recovery domain, strategy, fundraising, something else?",
    placeholder: "e.g. agent design + clinical compliance",
  },
  {
    key: 'timeline',
    prompt: "What's your timeline? This week, this month, this quarter, or just exploring?",
    placeholder: "e.g. need to ship before EOQ",
  },
  {
    key: 'contact',
    prompt: "Best way to reach you — email is best. Optionally drop your name and what company.",
    placeholder: "you@company.com · Jane Doe · Acme Recovery",
  },
];

// Trigger words that move Q&A → office hours automatically
const TRIGGERS = [
  /\bhire\b/i, /\bwork (with|together)\b/i, /\bbuild .* with\b/i,
  /\bscope\b/i, /\boffice hours\b/i, /\bcollaborate\b/i, /\bconsult\b/i,
  /\bproject\b/i, /\badvise\b/i, /\bhelp me\b/i, /\bbring .* on\b/i,
  /\blooking for\b/i, /\bcan you build\b/i, /\bwould you\b/i,
];

// ── Mode state ──
const MODE_QA = 'qa';
const MODE_OFFICE = 'office';
const MODE_DONE = 'done';

const state = {
  mode: MODE_QA,
  stepIndex: 0,
  answers: {},
  busy: false,
};

// ── DOM helpers ──
const $ = (id) => document.getElementById(id);
const thread = () => $('demoThread');
const input = () => $('demoInput');
const form = () => $('demoForm');

function escape(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function addRow({ who, html, klass }) {
  const row = document.createElement('div');
  row.className = `demo-row demo-row-${who}${klass ? ' ' + klass : ''}`;
  row.innerHTML = `
    <span class="who mono small soft">${who === 'agent' ? 'agent' : 'you'}</span>
    <p>${html}</p>
  `;
  thread().appendChild(row);
  thread().scrollTop = thread().scrollHeight;
  return row;
}

function addAgentTyping() {
  const row = document.createElement('div');
  row.className = 'demo-row demo-row-agent thinking';
  row.innerHTML = `<span class="who mono small soft">agent</span><p>thinking</p>`;
  thread().appendChild(row);
  thread().scrollTop = thread().scrollHeight;
  return row;
}

function setBusy(b) {
  state.busy = b;
  const btn = form().querySelector('button');
  if (btn) btn.disabled = b;
  input().disabled = b;
  if (!b) setTimeout(() => input().focus(), 80);
}

// ── Mode banner / progress strip ──
function showOfficeBanner() {
  let banner = $('demoModeBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'demoModeBanner';
    banner.className = 'demo-mode-banner';
    banner.innerHTML = `
      <span class="left">// office hours · scoping a project</span>
      <button type="button" id="cancelOffice">cancel · back to Q&A</button>
    `;
    thread().parentNode.insertBefore(banner, thread());
    $('cancelOffice').addEventListener('click', cancelOfficeHours);
  }
  // progress
  let prog = $('demoProgress');
  if (!prog) {
    prog = document.createElement('div');
    prog.id = 'demoProgress';
    prog.className = 'demo-progress';
    thread().parentNode.appendChild(prog);
  }
  renderProgress();
}

function renderProgress() {
  const prog = $('demoProgress');
  if (!prog) return;
  const total = OFFICE_HOURS_STEPS.length;
  let html = `<span>scoping · step ${Math.min(state.stepIndex + 1, total)} of ${total}</span>`;
  for (let i = 0; i < total; i++) {
    const cls = i < state.stepIndex ? 'pip done' :
                i === state.stepIndex ? 'pip active' : 'pip';
    html += `<span class="${cls}"></span>`;
  }
  prog.innerHTML = html;
}

function hideOfficeChrome() {
  $('demoModeBanner')?.remove();
  $('demoProgress')?.remove();
}

// ── Office hours: enter / next / cancel ──
function enterOfficeHours() {
  state.mode = MODE_OFFICE;
  state.stepIndex = 0;
  state.answers = {};
  showOfficeBanner();
  addRow({
    who: 'agent',
    html: `Switching into <em>office hours</em> mode. I'll ask 5 short questions, then I'll write a tight brief and send it straight to Mateo. Takes about 90 seconds.<br><br><strong>${escape(OFFICE_HOURS_STEPS[0].prompt)}</strong>`,
  });
  input().placeholder = OFFICE_HOURS_STEPS[0].placeholder;
}

function cancelOfficeHours() {
  state.mode = MODE_QA;
  state.stepIndex = 0;
  state.answers = {};
  hideOfficeChrome();
  addRow({
    who: 'agent',
    html: 'Switched back to Q&A. Ask me anything about Mateo.',
  });
  input().placeholder = "What did he build at Evergreen Fund?";
}

function nextOfficeStep(userText) {
  // Save the previous answer
  const prev = OFFICE_HOURS_STEPS[state.stepIndex];
  state.answers[prev.key] = userText;
  state.stepIndex += 1;
  renderProgress();

  if (state.stepIndex >= OFFICE_HOURS_STEPS.length) {
    completeOfficeHours();
    return;
  }
  const step = OFFICE_HOURS_STEPS[state.stepIndex];
  addRow({
    who: 'agent',
    html: `Got it. <strong>${escape(step.prompt)}</strong>`,
  });
  input().placeholder = step.placeholder;
}

async function completeOfficeHours() {
  state.mode = MODE_DONE;
  hideOfficeChrome();

  const a = state.answers;
  const typing = addAgentTyping();

  // Have the agent synthesize a short summary in Mateo's voice
  const summaryPrompt = `${MATEO_BIO}

A potential collaborator just walked through Mateo's office-hours intake. Here is what they said:
- What they're building: ${a.project}
- Stage: ${a.stage}
- Where they want input: ${a.help}
- Timeline: ${a.timeline}
- Contact: ${a.contact}

Write a SHORT 2-sentence reply in Mateo's voice. First sentence: a calm, specific reflection of what they need — concrete, not flattering. Second sentence: confirm Mateo will reach out at the contact above within 24 hours. No greetings, no sign-off, no marketing language. Plain. End there.`;

  let synthesized = '';
  try {
    synthesized = await window.claude.complete(summaryPrompt);
  } catch (e) {
    synthesized = "Got the picture. Mateo will reach out at the email you gave us within 24 hours.";
  }
  typing.remove();

  // Render the confirmation card
  const card = document.createElement('div');
  card.className = 'demo-confirm';
  const body = encodeURIComponent(
    `OFFICE HOURS BRIEF — via itsmateo.wtf\n\n` +
    `Project: ${a.project}\n` +
    `Stage: ${a.stage}\n` +
    `Where I want your input: ${a.help}\n` +
    `Timeline: ${a.timeline}\n` +
    `Contact: ${a.contact}\n`
  );
  const subject = encodeURIComponent(`Office hours · ${(a.project || '').slice(0, 60)}`);

  card.innerHTML = `
    <h4>// brief · sent</h4>
    <p>${escape(synthesized)}</p>
    <dl>
      <dt>Project</dt><dd>${escape(a.project)}</dd>
      <dt>Stage</dt><dd>${escape(a.stage)}</dd>
      <dt>Where</dt><dd>${escape(a.help)}</dd>
      <dt>Timeline</dt><dd>${escape(a.timeline)}</dd>
      <dt>Contact</dt><dd>${escape(a.contact)}</dd>
    </dl>
    <div class="actions">
      <a href="mailto:mattm@beora.ai?subject=${subject}&body=${body}">→ Open in email</a>
      <a href="#" class="ghost" id="copyBrief">Copy brief</a>
      <a href="#" class="ghost" id="restartHours">Start over</a>
    </div>
  `;
  thread().appendChild(card);
  thread().scrollTop = thread().scrollHeight;

  $('copyBrief').addEventListener('click', (e) => {
    e.preventDefault();
    const text = `OFFICE HOURS BRIEF — via itsmateo.wtf\n\nProject: ${a.project}\nStage: ${a.stage}\nWhere I want your input: ${a.help}\nTimeline: ${a.timeline}\nContact: ${a.contact}`;
    navigator.clipboard.writeText(text).then(() => {
      e.target.textContent = 'Copied ✓';
      setTimeout(() => { if (e.target) e.target.textContent = 'Copy brief'; }, 1800);
    });
  });
  $('restartHours').addEventListener('click', (e) => {
    e.preventDefault();
    state.mode = MODE_QA;
    enterOfficeHours();
  });

  input().placeholder = "Anything else? Ask away.";
  state.mode = MODE_QA; // allow more Q&A after the brief
}

// ── Q&A mode: send to Claude ──
async function answerQuestion(question) {
  const prompt = `${MATEO_BIO}

A reader of the wiki just asked: "${question}"

Reply in Mateo's voice — calm, specific, plain language. 1-3 short paragraphs at most. If the question signals interest in working with him or building something together, end with a single sentence offering to walk them through a quick office-hours intake. Never use marketing language. Don't use emoji. Don't say "Great question". Just answer.`;

  try {
    return await window.claude.complete(prompt);
  } catch (e) {
    return "Sorry — agent's offline right now. For real questions, email mattm@beora.ai.";
  }
}

// Heuristic — does the user's message want to start scoping a project?
function isOfficeIntent(text) {
  return TRIGGERS.some((re) => re.test(text));
}

// ── Form submit ──
async function onSubmit(e) {
  e.preventDefault();
  if (state.busy) return;
  const text = input().value.trim();
  if (!text) return;
  input().value = '';

  addRow({ who: 'user', html: escape(text) });
  setBusy(true);

  try {
    if (state.mode === MODE_OFFICE) {
      nextOfficeStep(text);
      setBusy(false);
      return;
    }

    // QA mode — but check intent first
    if (state.mode === MODE_QA && isOfficeIntent(text)) {
      // briefly acknowledge then switch
      const typing = addAgentTyping();
      await sleep(450);
      typing.remove();
      enterOfficeHours();
      setBusy(false);
      return;
    }

    const typing = addAgentTyping();
    const reply = await answerQuestion(text);
    typing.remove();
    // Light formatting — paragraph breaks
    const html = escape(reply)
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    addRow({ who: 'agent', html });
  } catch (err) {
    addRow({ who: 'agent', html: 'Hit an error — try again, or email mattm@beora.ai.' });
  } finally {
    setBusy(false);
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── TOC toggle ──
function wireTOC() {
  document.querySelector('[data-toggle="toc"]')?.addEventListener('click', (e) => {
    const list = document.getElementById('tocList');
    if (!list) return;
    const hidden = list.style.display === 'none';
    list.style.display = hidden ? '' : 'none';
    e.target.textContent = hidden ? '[ hide ]' : '[ show ]';
  });
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  form()?.addEventListener('submit', onSubmit);
  wireTOC();
});
