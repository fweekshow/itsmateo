/* ============================================================
   itsmateo.wtf — site script
   Minimal hero card + on-demand chat. Chip-driven YC-style intake.
   Branches: BUILD, HIRE, RECOVERY, QA.
   Zero AI calls on structured paths. QA path hits /api/chat.
   ============================================================ */

// ── FLOW tree — every step keyed by id ─────────────────────────
// step: { message, chips?: [{label, value, next}], freeText?: {key, placeholder, next}, terminal? }
const FLOW = {
  root: {
    message: "Hey. I'm Mateo. I built clinical AI for addiction recovery, shipped onchain agents for Coinbase, and run a private intervention practice. What's going on for you?",
    chips: [
      { label: "I'm building something", value: "building", next: "build_q1" },
      { label: "I want to hire or work with you", value: "hire", next: "hire_q1" },
      { label: "I need recovery or intervention help", value: "recovery", next: "recovery_msg" },
      { label: "Just curious about your work", value: "curious", next: "qa_open" },
    ],
  },

  // ── BUILD path ──────────────────────────────────────────────
  build_q1: {
    message: "Tell me what you're building. One line is plenty.",
    freeText: { key: "project", placeholder: "e.g. an AI intake tool for our clinic", next: "build_q2" },
  },
  build_q2: {
    message: "What's the goal? No wrong answer — money and mission are both real.",
    chips: [
      { label: "Make money", value: "make money", next: "build_q3" },
      { label: "Help people", value: "help people", next: "build_q3" },
      { label: "Both", value: "both", next: "build_q3" },
      { label: "Still figuring it out", value: "still figuring it out", next: "build_q3" },
    ],
    answerKey: "goal",
  },
  build_q3: {
    message: "Where are you actually stuck right now?",
    chips: [
      { label: "Don't know what to build yet", value: "don't know what to build yet", next: "build_q4" },
      { label: "Know what to build, can't execute", value: "know what to build, can't execute", next: "build_q4" },
      { label: "Built it, not getting traction", value: "built it, not getting traction", next: "build_q4" },
      { label: "Scaling something that already works", value: "scaling something that already works", next: "build_q4" },
      { label: "Something else", value: "__other", next: "build_q3_other" },
    ],
    answerKey: "stuck",
  },
  build_q3_other: {
    message: "Got it — describe it in a line.",
    freeText: { key: "stuck", placeholder: "where you're actually stuck", next: "build_q4" },
  },
  build_q4: {
    message: "What's the smallest win that would feel real?",
    chips: [
      { label: "Ship a working prototype", value: "ship a working prototype", next: "build_q5" },
      { label: "Get first paying customer", value: "get first paying customer", next: "build_q5" },
      { label: "Get first person helped", value: "get first person helped", next: "build_q5" },
      { label: "Get funding or a yes from someone important", value: "funding or a yes from someone important", next: "build_q5" },
      { label: "Clarity on what to do next", value: "clarity on what to do next", next: "build_q5" },
    ],
    answerKey: "win",
  },
  build_q5: {
    message: "What kind of help do you actually need?",
    chips: [
      { label: "Engineering", value: "engineering", next: "consult" },
      { label: "AI / agent design", value: "ai / agent design", next: "consult" },
      { label: "Clinical / recovery domain", value: "clinical / recovery domain", next: "consult" },
      { label: "Product strategy", value: "product strategy", next: "consult" },
      { label: "Fundraising / pitching", value: "fundraising / pitching", next: "consult" },
      { label: "Just a sounding board", value: "just a sounding board", next: "consult" },
    ],
    answerKey: "help",
  },

  // ── HIRE path ───────────────────────────────────────────────
  hire_q1: {
    message: "What kind of engagement are you thinking?",
    chips: [
      { label: "Full-time / in-house", value: "full-time / in-house", next: "hire_q2" },
      { label: "Contract or project", value: "contract or project", next: "hire_q2" },
      { label: "Advisory", value: "advisory", next: "hire_q2" },
      { label: "Co-founder", value: "co-founder", next: "hire_q2" },
    ],
    answerKey: "engagement",
  },
  hire_q2: {
    message: "What's the domain?",
    chips: [
      { label: "AI / agents", value: "ai / agents", next: "hire_q3" },
      { label: "Clinical / behavioral health", value: "clinical / behavioral health", next: "hire_q3" },
      { label: "Onchain / web3", value: "onchain / web3", next: "hire_q3" },
      { label: "General engineering", value: "general engineering", next: "hire_q3" },
      { label: "Recovery / intervention", value: "recovery / intervention", next: "hire_q3" },
      { label: "Not sure yet", value: "not sure yet", next: "hire_q3" },
    ],
    answerKey: "domain",
  },
  hire_q3: {
    message: "Timeline?",
    chips: [
      { label: "ASAP", value: "ASAP", next: "hire_q4" },
      { label: "This month", value: "this month", next: "hire_q4" },
      { label: "This quarter", value: "this quarter", next: "hire_q4" },
      { label: "Just exploring", value: "just exploring", next: "hire_q4" },
    ],
    answerKey: "timeline",
  },
  hire_q4: {
    message: "Last one — one line, what's it for?",
    freeText: { key: "project", placeholder: "e.g. lead engineer for our YC-backed recovery startup", next: "consult" },
  },

  // ── RECOVERY path ────────────────────────────────────────────
  recovery_msg: {
    message: "Mateo runs a private intervention and sober companion practice. This is real and personal — not a bot intake. Reach him directly: <a href=\"mailto:mateo@basemate.app\">mateo@basemate.app</a> or <a href=\"mailto:meakin.matt@gmail.com\">meakin.matt@gmail.com</a>. He responds to recovery messages first.",
    terminal: true,
  },

  // ── QA path ──────────────────────────────────────────────────
  qa_open: {
    message: "Ask me anything — Beora, the Coinbase agents, the Evergreen years, the recovery work. I'll answer in Mateo's voice.",
    qaMode: true,
  },
};

// ── State ──────────────────────────────────────────────────────
const state = {
  step: 'root',
  path: 'root',        // 'build' | 'hire' | 'recovery' | 'qa'
  answers: {},
  qaTurns: 0,
  busy: false,
};

// ── DOM helpers ────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const thread = () => $('hcThread');
const threadWrap = () => document.querySelector('.chat-thread-wrap');
const chipBox = () => $('hcChips');
const form = () => $('hcForm');
const input = () => $('hcInput');

function scrollThread() {
  const wrap = threadWrap();
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

function escape(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

function addRow({ who, html, allowLinks }) {
  const row = document.createElement('div');
  row.className = `hc-row hc-row-${who}`;
  const safe = allowLinks ? html : escape(html);
  row.innerHTML = `
    <span class="who mono small">${who === 'agent' ? 'mateo' : 'you'}</span>
    <p>${safe}</p>
  `;
  thread().appendChild(row);
  scrollThread();
  return row;
}

function addTyping() {
  const row = document.createElement('div');
  row.className = 'hc-row hc-row-agent thinking';
  row.innerHTML = `<span class="who mono small">mateo</span><p>thinking</p>`;
  thread().appendChild(row);
  scrollThread();
  return row;
}

function clearChips() { chipBox().innerHTML = ''; }
function showForm(show) {
  const f = form();
  const footer = document.getElementById('chatFooter');
  if (f) f.style.display = show ? '' : 'none';
  if (footer) footer.hidden = !show;
  if (show) setTimeout(() => input().focus(), 60);
}

function setBusy(b) {
  state.busy = b;
  const btn = form().querySelector('button');
  if (btn) btn.disabled = b;
  input().disabled = b;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Chip rendering ─────────────────────────────────────────────
function renderChips(chips) {
  clearChips();
  chips.forEach(({ label, value, next }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hc-chip';
    btn.textContent = label;
    btn.addEventListener('click', () => onChipClick({ label, value, next }));
    chipBox().appendChild(btn);
  });
}

function onChipClick({ label, value, next }) {
  if (state.busy) return;
  const current = FLOW[state.step];
  if (current && current.answerKey) {
    state.answers[current.answerKey] = value === '__other' ? '' : value;
  }
  addRow({ who: 'user', html: label });
  clearChips();
  trackPath(state.step, next);
  advance(next);
}

// Tag which top-level path we're in based on the destination
function trackPath(_fromStep, toStep) {
  if (toStep.startsWith('build')) state.path = 'build';
  else if (toStep.startsWith('hire')) state.path = 'hire';
  else if (toStep === 'recovery_msg') state.path = 'recovery';
  else if (toStep === 'qa_open') state.path = 'qa';
  else if (toStep === 'root') state.path = 'root';
}

// ── Step driver ────────────────────────────────────────────────
async function advance(nextStep) {
  state.step = nextStep;

  // Synthetic "consult" step — render the CTA card and stop
  if (nextStep === 'consult') {
    setBusy(true);
    const typing = addTyping();
    await sleep(550);
    typing.remove();
    renderConsultCTA();
    showForm(true);
    input().placeholder = "or type a note";
    setBusy(false);
    return;
  }

  const step = FLOW[nextStep];
  if (!step) return;

  setBusy(true);
  const typing = addTyping();
  await sleep(420);
  typing.remove();

  addRow({ who: 'agent', html: step.message, allowLinks: true });

  if (step.terminal) {
    showForm(false);
    setBusy(false);
    return;
  }

  if (step.qaMode) {
    clearChips();
    showForm(true);
    input().placeholder = "ask anything about Mateo";
    setBusy(false);
    return;
  }

  if (step.chips) {
    showForm(false);
    renderChips(step.chips);
    setBusy(false);
    return;
  }

  if (step.freeText) {
    clearChips();
    showForm(true);
    input().placeholder = step.freeText.placeholder || 'type your answer';
    setBusy(false);
    return;
  }

  setBusy(false);
}

// ── Form submit (QA + free-text steps) ─────────────────────────
async function onSubmit(e) {
  e.preventDefault();
  if (state.busy) return;
  const text = input().value.trim();
  if (!text) return;
  input().value = '';

  addRow({ who: 'user', html: text });
  setBusy(true);

  const step = FLOW[state.step];

  // Free-text step in a structured flow
  if (step && step.freeText) {
    state.answers[step.freeText.key] = text;
    setBusy(false);
    advance(step.freeText.next);
    return;
  }

  // QA mode — call Claude
  if (step && step.qaMode) {
    const typing = addTyping();
    try {
      const reply = await answerQuestion(text);
      typing.remove();
      const html = escape(reply).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
      addRow({ who: 'agent', html, allowLinks: true });
      state.qaTurns += 1;
      // After 2 turns, offer the structured paths
      if (state.qaTurns >= 2) {
        await sleep(400);
        addRow({
          who: 'agent',
          html: 'If any of this is hitting close to something you\'re working on or want to bring Mateo in on — pick one:',
          allowLinks: true,
        });
        renderChips([
          { label: "I'm building something", value: "building", next: "build_q1" },
          { label: "I want to hire or work with you", value: "hire", next: "hire_q1" },
          { label: "Keep asking questions", value: "more qa", next: "qa_open" },
        ]);
        showForm(false);
        state.qaTurns = 0;
      }
    } catch (err) {
      typing.remove();
      addRow({ who: 'agent', html: "Agent's offline. Email mateo@basemate.app." });
    }
    setBusy(false);
    return;
  }

  setBusy(false);
}

// ── QA: backend call ───────────────────────────────────────────
async function answerQuestion(question) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (res.status === 429) {
      return "Whoa — too many questions in a short window. Try again in a bit, or just email mateo@basemate.app.";
    }
    if (!res.ok) {
      return "Agent's offline right now. Email mateo@basemate.app and Mateo will reply personally.";
    }
    const data = await res.json();
    return data.reply || "No reply from the agent — try again, or email mateo@basemate.app.";
  } catch (err) {
    return "Couldn't reach the agent. Email mateo@basemate.app instead.";
  }
}

// ── Brief building + consult CTA ───────────────────────────────
function buildSummary() {
  const a = state.answers;
  if (state.path === 'build') {
    const parts = [];
    if (a.project) parts.push(`You're building ${a.project}`);
    if (a.goal) parts.push(`the goal is to ${a.goal}`);
    if (a.stuck) parts.push(`you're stuck on ${a.stuck}`);
    if (a.win) parts.push(`a real win looks like ${a.win}`);
    if (a.help) parts.push(`and you'd want Mateo's help on ${a.help}`);
    return parts.join(', ') + '.';
  }
  if (state.path === 'hire') {
    const parts = [];
    if (a.engagement) parts.push(`Looking for a ${a.engagement} engagement`);
    if (a.domain) parts.push(`in ${a.domain}`);
    if (a.timeline) parts.push(`on a ${a.timeline} timeline`);
    if (a.project) parts.push(`for ${a.project}`);
    return parts.join(', ') + '.';
  }
  return 'Reached out via the chat on itsmateo.wtf.';
}

function buildEmailBody() {
  const a = state.answers;
  const lines = ['Sent from the chat on itsmateo.wtf', ''];
  if (state.path === 'build') {
    lines.push('// build path');
    if (a.project) lines.push(`Project: ${a.project}`);
    if (a.goal) lines.push(`Goal: ${a.goal}`);
    if (a.stuck) lines.push(`Stuck on: ${a.stuck}`);
    if (a.win) lines.push(`Win that would feel real: ${a.win}`);
    if (a.help) lines.push(`Help needed: ${a.help}`);
  } else if (state.path === 'hire') {
    lines.push('// hire path');
    if (a.engagement) lines.push(`Engagement: ${a.engagement}`);
    if (a.domain) lines.push(`Domain: ${a.domain}`);
    if (a.timeline) lines.push(`Timeline: ${a.timeline}`);
    if (a.project) lines.push(`For: ${a.project}`);
  }
  lines.push('', '— who I am:', '', '');
  return lines.join('\n');
}

function buildSubject(prefix) {
  const a = state.answers;
  const topic = (a.project || a.domain || 'the work').slice(0, 60);
  return `${prefix} · ${topic}`;
}

function renderConsultCTA() {
  const summary = buildSummary();
  const body = encodeURIComponent(buildEmailBody());
  const subjConsult = encodeURIComponent(buildSubject('Consult'));
  const subjEmail = encodeURIComponent(buildSubject('Hi Mateo'));

  const card = document.createElement('div');
  card.className = 'hc-consult-card';
  card.innerHTML = `
    <div class="hcc-label mono small">// here's what I heard</div>
    <p class="hcc-summary">${escape(summary)}</p>
    <p class="hcc-ask">Would you like to set up a consult with Matthew?</p>
    <div class="hcc-actions">
      <a class="hcc-btn primary" href="mailto:mateo@basemate.app?subject=${subjConsult}&body=${body}">
        → Yes, let's talk
      </a>
      <a class="hcc-btn ghost" href="mailto:mateo@basemate.app?subject=${subjEmail}&body=${body}">
        Send an email instead
      </a>
    </div>
    <div class="hcc-foot mono small">
      lands directly in mateo@basemate.app · expect a reply within 24h
    </div>
  `;
  thread().appendChild(card);
  thread().scrollTop = thread().scrollHeight;

  // Offer restart
  renderChips([
    { label: "Start over", value: "restart", next: "root" },
  ]);
  // restart resets state
  chipBox().querySelector('.hc-chip')?.addEventListener('click', () => {
    state.answers = {};
    state.path = 'root';
    state.qaTurns = 0;
  });
}

// ── TOC toggle (unchanged) ─────────────────────────────────────
function wireTOC() {
  document.querySelector('[data-toggle="toc"]')?.addEventListener('click', (e) => {
    const list = document.getElementById('tocList');
    if (!list) return;
    const hidden = list.style.display === 'none';
    list.style.display = hidden ? '' : 'none';
    e.target.textContent = hidden ? '[ hide ]' : '[ show ]';
  });
}

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  form()?.addEventListener('submit', onSubmit);
  wireTOC();

  const backdrop = document.getElementById('chatBackdrop');
  const modal = document.getElementById('chatModal');
  const openBtn = document.getElementById('openChatBtn');
  const closeBtn = document.getElementById('closeChatBtn');
  let chatStarted = false;
  let lastFocused = null;
  let scrollY = 0;

  function openChat() {
    if (!backdrop) return;
    lastFocused = document.activeElement;
    scrollY = window.scrollY;
    document.body.style.top = `-${scrollY}px`;

    backdrop.hidden = false;
    backdrop.removeAttribute('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('chat-open');
    void backdrop.offsetHeight;
    backdrop.classList.add('is-open');

    if (!chatStarted) {
      advance('root');
      chatStarted = true;
    }

    setTimeout(() => {
      const inp = input();
      if (inp && form()?.style.display !== 'none') {
        inp.focus();
      } else {
        closeBtn?.focus();
      }
      scrollThread();
    }, 240);
  }

  function closeChat() {
    if (!backdrop) return;
    backdrop.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('chat-open');
    document.body.style.top = '';
    setTimeout(() => {
      backdrop.hidden = true;
      window.scrollTo(0, scrollY);
      lastFocused?.focus?.();
    }, 200);
  }

  openBtn?.addEventListener('click', openChat);
  closeBtn?.addEventListener('click', closeChat);

  // Click backdrop (but not the modal itself) to close
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closeChat();
  });

  // Esc to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop && !backdrop.hidden) closeChat();
  });
});
