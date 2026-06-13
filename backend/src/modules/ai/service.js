'use strict';
// ============================================================================
//  Multi-provider AI proxy — ULTIMATE FALLBACK CHAIN
// ============================================================================
//  We walk a list of providers in priority order until one returns a 2xx.
//  If every provider fails (rate limit / outage / key revoked), we fall
//  back to a local heuristic that produces a sensible, role-aware answer
//  so the user ALWAYS gets a response.
//
//  Priority order (per your env):
//    1. Groq             — llama-3.3-70b-versatile,    fast free tier
//    2. Gemini           — gemini-2.5-flash,           broad coverage
//    3. DeepSeek         — deepseek-chat,              if balance > 0
//    4. Anthropic        — claude-sonnet-4             if key set
//    5. FastAPI          — on-prem proxy               if URL set
//    6. Local heuristic  — always works                last resort
//
//  Every call returns { answer, provider, latencyMs, model } so the UI
//  can show "answered by Groq · llama-3.3-70b · 412ms" for transparency.
// ============================================================================

const config = require('../../config');
const pool = require('../../config/db');

// ---- System prompt — concise, role-aware ----
const SYSTEM_PROMPT = (role) =>
  `You are the Quintern AI Assistant. The current user role is ${role}.

 Quintern is a 5-tier cohort operations platform for intern programs. Stack: Node.js/Fastify backend, React/Vite frontend, PostgreSQL, JWT auth, Argon2, Upstash Redis.
Modules: Attendance (PRESENT/ABSENT/LEAVE/EXAM_LEAVE/HALF_DAY/WFH), Ratings (1-10 scale, immutable), Projects (kanban/list/calendar, milestones, risks), Social Tasks + Proof Submissions, Meetings, Notifications, Reports, Audit Logs, AI Insights.

Give concise, role-aware answers. Use markdown bullets. Keep under 150 words unless the topic needs more. Never reveal secrets, internal endpoints, or API keys. If the question is outside the platform's scope, say so and suggest the closest module.`.trim();

// ---- Per-provider timeout (a bit less than the request-level budget) ----
const PER_PROVIDER_TIMEOUT = Math.max(
  4000,
  (config.ai.timeout || 25000) - 5000
);

async function withTimeout(promise, ms, label) {
  let to;
  const guard = new Promise((_, rej) => {
    to = setTimeout(() => rej(new Error(`${label}-timeout`)), ms);
  });
  try {
    return await Promise.race([promise, guard]);
  } finally {
    clearTimeout(to);
  }
}

// ---- Tiny in-memory cache (5 min TTL) so we don't burn quota on repeats ----
const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000;
function cacheKey(provider, system, messages) {
  const last = messages[messages.length - 1];
  return `${provider}::${(last?.content || '').slice(0, 200)}`;
}
function getCached(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > CACHE_TTL) {
    CACHE.delete(key);
    return null;
  }
  return hit.v;
}
function setCached(key, value) {
  if (CACHE.size > 200) CACHE.clear();
  CACHE.set(key, { t: Date.now(), v: value });
}

// ============================================================================
//  PROVIDER 1 — Groq (OpenAI-compatible)
// ============================================================================
async function callGroq({ system, messages }) {
  if (!config.ai.groqKey) throw new Error('groq-no-key');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.groqKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1000,
      temperature: 0.4,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`groq-${res.status} ${body.slice(0, 80)}`);
  }
  const data = await res.json();
  return {
    text: (data.choices?.[0]?.message?.content || '').trim(),
    model: 'llama-3.3-70b-versatile',
  };
}

// ============================================================================
//  PROVIDER 2 — Google Gemini (newer model + robust error handling)
// ============================================================================
async function callGemini({ system, messages }) {
  if (!config.ai.geminiKey) throw new Error('gemini-no-key');
  // Try several model names; the cheapest/fastest one that works wins.
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
  ];
  let lastErr = null;
  for (const model of models) {
    try {
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.ai.geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { maxOutputTokens: 1000, temperature: 0.4 },
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        lastErr = new Error(
          `gemini-${model}-${res.status} ${body.slice(0, 100)}`
        );
        continue;
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text: text.trim(), model };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('gemini-all-failed');
}

// ============================================================================
//  PROVIDER 3 — DeepSeek
// ============================================================================
async function callDeepSeek({ system, messages }) {
  if (!config.ai.deepseekKey) throw new Error('deepseek-no-key');
  const base = config.ai.deepseekBaseUrl || 'https://api.deepseek.com';
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.deepseekKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 1000,
      temperature: 0.4,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`deepseek-${res.status} ${body.slice(0, 80)}`);
  }
  const data = await res.json();
  return {
    text: (data.choices?.[0]?.message?.content || '').trim(),
    model: 'deepseek-chat',
  };
}

// ============================================================================
//  PROVIDER 4 — Anthropic Claude
// ============================================================================
async function callAnthropic({ system, messages }) {
  if (!config.ai.anthropicKey) throw new Error('anthropic-no-key');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.ai.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`anthropic-${res.status} ${body.slice(0, 80)}`);
  }
  const data = await res.json();
  return {
    text: (data.content?.[0]?.text || '').trim(),
    model: 'claude-sonnet-4-20250514',
  };
}

// ============================================================================
//  PROVIDER 5 — Local FastAPI proxy
// ============================================================================
async function callFastAPI({ system, messages }) {
  if (!config.ai.fastapiUrl) throw new Error('fastapi-no-url');
  const res = await fetch(config.ai.fastapiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`fastapi-${res.status} ${body.slice(0, 80)}`);
  }
  const data = await res.json();
  return {
    text: (data.answer || data.message || data.response || '').trim(),
    model: 'fastapi',
  };
}

// ============================================================================
//  PROVIDER 6 — Local heuristic (always works, no network)
// ============================================================================
//  Renders a role-aware summary from live platform data so the UI never
//  shows an empty bubble. This is the safety net.
async function callHeuristic({ role, message, history = [] }) {
  let summary = {
    role,
    pending_approvals: 0,
    open_tasks: 0,
    unread_notifications: 0,
    active_projects: 0,
  };
  try {
    const [tasks, notifs, projects] = await Promise.all([
      pool
        .query(
          `SELECT COUNT(*)::int AS c FROM project_tasks t
                 JOIN project_members m ON m.project_id = t.project_id
                 WHERE m.user_id = $1 AND t.deleted_at IS NULL AND t.status NOT IN ('DONE','CANCELLED')`,
          [/* user id */ null]
        )
        .catch(() => ({ rows: [{ c: 0 }] })),
      pool
        .query(
          `SELECT COUNT(*)::int AS c FROM notifications WHERE read = FALSE AND deleted_at IS NULL`,
          []
        )
        .catch(() => ({ rows: [{ c: 0 }] })),
      pool
        .query(
          `SELECT COUNT(*)::int AS c FROM projects WHERE deleted_at IS NULL AND status = 'ACTIVE'`,
          []
        )
        .catch(() => ({ rows: [{ c: 0 }] })),
    ]);
    summary.unread_notifications = notifs.rows[0]?.c || 0;
    summary.active_projects = projects.rows[0]?.c || 0;
  } catch (e) {
    /* heuristic is best-effort */
  }

  const m = (message || '').toLowerCase().trim();
  let answer = '';
  if (/rate|score|1-10|rating/.test(m)) {
    answer = `**Rating scale in Quintern:** Every rating is on a **1–10 scale** across seven categories (PERFORMANCE, TASK, PROJECT, INTERN, TEAM, MENTOR, REVIEW).\n\n- 8–10: Exceptional\n- 6–7: Solid / on target\n- 4–5: Needs work\n- 1–3: Concerning\n\nRatings are **immutable** — once submitted they form an audit-grade history. Use the **Ratings** page to give or view feedback.`;
  } else if (/attendance|present|absent|wfh|half.?day/.test(m)) {
    answer = `**Attendance states supported:** PRESENT, ABSENT, LEAVE, EXAM_LEAVE, HALF_DAY, WFH.\n\nMark attendance from the **Attendance** page (single or bulk). Attendance is one of the inputs to the team health score on the dashboard.`;
  } else if (/project|kanban|task/.test(m)) {
    answer = `**Projects** live at **/projects**. You can:\n\n- Create projects with priorities + health\n- Add tasks across 6 status columns (kanban) or list/calendar view\n- Track milestones, risks, dependencies, and members\n\nActive projects on the platform: **${summary.active_projects}**.`;
  } else if (/team|people|member|who/.test(m)) {
    answer = `Use the **My Team** page (managers) or the **Admin → User Management** page (admins) to view and manage people. Roles: Admin, Senior TL, TL, Captain, Intern.`;
  } else if (/login|sign in|auth|password/.test(m)) {
    answer = `**Sign in** at /login with your Quintern email and password. If you forgot it, click "Forgot password" on the sign-in screen. Sessions are JWT-based and use secure HTTP-only cookies for refresh tokens.`;
  } else if (/audit|log|history|security/.test(m)) {
    answer = `The **Audit Log** (admins only) records every sensitive action — logins, attendance marks, ratings, project changes, password resets. It is append-only and immutable.`;
  } else if (/export|download|csv|report/.test(m)) {
    answer = `Admins can export attendance, ratings, and task reports as CSV from **Admin → Exports**. Pick a date range and click any card.`;
  } else if (/help|what can you|how do i/.test(m)) {
    answer = `I can help with:\n\n- **Ratings** — 1–10 scale, categories, how to give feedback\n- **Attendance** — statuses, bulk marking, heatmaps\n- **Projects** — kanban, milestones, risks, members\n- **Team & roles** — hierarchy, permissions, profiles\n- **Reports & exports** — CSV downloads\n\nAsk me anything specific.`;
  } else {
    // Generic role-aware greeting
    const tips = {
      ADMIN:
        'Try asking: "summarize org attendance", "top performers this month", or "how do I add a new user".',
      SENIOR_TL:
        'Try asking: "my team summary", "best rating practices", or "how do I mark team attendance".',
      TL: 'Try asking: "rate my team", "mark attendance", or "view team performance".',
      CAPTAIN:
        'Try asking: "who are my interns", "rate my interns", or "how do I track attendance".',
      INTERN:
        'Try asking: "my attendance", "my ratings", or "how do I upload a proof".',
    };
    answer = `Hi! I'm the Quintern AI assistant. I can help you navigate the platform, draft workflows, and answer product questions.\n\n${tips[role] || tips.INTERN}`;
  }
  return { text: answer, model: 'heuristic' };
}

// ============================================================================
//  Fallback chain runner
// ============================================================================
const PROVIDER_CHAIN = [
  { name: 'groq', fn: callGroq, needs: () => !!config.ai.groqKey },
  { name: 'gemini', fn: callGemini, needs: () => !!config.ai.geminiKey },
  { name: 'deepseek', fn: callDeepSeek, needs: () => !!config.ai.deepseekKey },
  {
    name: 'anthropic',
    fn: callAnthropic,
    needs: () => !!config.ai.anthropicKey,
  },
  { name: 'fastapi', fn: callFastAPI, needs: () => !!config.ai.fastapiUrl },
];

async function ask({ role = 'INTERN', history = [], message }) {
  const system = SYSTEM_PROMPT(role);
  const messages = [...history, { role: 'user', content: message }];

  // Try each configured provider
  const errors = [];
  for (const p of PROVIDER_CHAIN) {
    if (!p.needs()) continue;
    const start = Date.now();
    const key = cacheKey(p.name, system, messages);
    const cached = getCached(key);
    if (cached) return { ...cached, cached: true };
    try {
      const { text, model } = await withTimeout(
        p.fn({ system, messages }),
        PER_PROVIDER_TIMEOUT,
        p.name
      );
      if (text && text.trim().length > 0) {
        const result = {
          answer: text.trim(),
          provider: p.name,
          model,
          latencyMs: Date.now() - start,
          cached: false,
        };
        setCached(key, {
          answer: result.answer,
          provider: result.provider,
          model: result.model,
        });
        return result;
      }
      errors.push({ provider: p.name, err: 'empty-response' });
    } catch (err) {
      errors.push({ provider: p.name, err: err.message });
    }
  }

  // Last-resort: local heuristic. This is always-on, no network.
  try {
    const start = Date.now();
    const { text, model } = await callHeuristic({ role, message, history });
    return {
      answer: text,
      provider: 'heuristic',
      model,
      latencyMs: Date.now() - start,
      cached: false,
      fallback: errors,
    };
  } catch (e) {
    // Should never happen — heuristic is pure JS.
    const err = new Error('All AI providers and heuristic failed');
    err.errors = errors;
    throw err;
  }
}

async function askSummary({ role = 'INTERN' }) {
  // Lightweight dashboard insight that doesn't even need the chat model.
  // Used by /ai/insights.
  try {
    const [tasks, notifs, projects] = await Promise.all([
      pool
        .query(
          `SELECT COUNT(*)::int AS c FROM project_tasks t
                 JOIN project_members m ON m.project_id = t.project_id
                 WHERE m.user_id = (SELECT id FROM users WHERE id = m.user_id LIMIT 1) AND t.deleted_at IS NULL AND t.status NOT IN ('DONE','CANCELLED')`
        )
        .catch(() => ({ rows: [{ c: 0 }] })),
      pool
        .query(
          `SELECT COUNT(*)::int AS c FROM notifications WHERE read = FALSE AND deleted_at IS NULL`,
          []
        )
        .catch(() => ({ rows: [{ c: 0 }] })),
      pool
        .query(
          `SELECT COUNT(*)::int AS c FROM projects WHERE deleted_at IS NULL AND status = 'ACTIVE'`,
          []
        )
        .catch(() => ({ rows: [{ c: 0 }] })),
    ]);
    const prompt = `Generate 3 concise, role-aware insights (1 sentence each, markdown bullets) for a ${role} based on: ${JSON.stringify(
      {
        active_projects: projects.rows[0]?.c || 0,
        unread_notifications: notifs.rows[0]?.c || 0,
      }
    )}`;
    const result = await ask({ role, history: [], message: prompt });
    return {
      ...result,
      summary: {
        role,
        active_projects: projects.rows[0]?.c || 0,
        unread_notifications: notifs.rows[0]?.c || 0,
      },
    };
  } catch (e) {
    return {
      answer: `- You're a ${role} — open the dashboard to see what's on your plate today.\n- Add team attendance, project progress, and ratings for a more tailored view.\n- All insights are role-aware, so check back after activity lands.`,
      provider: 'heuristic',
      model: 'heuristic',
      latencyMs: 0,
      cached: false,
      summary: { role },
    };
  }
}

module.exports = {
  ask,
  askSummary,
  PROVIDERS: PROVIDER_CHAIN.map((p) => p.name),
};
