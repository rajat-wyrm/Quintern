import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Skeleton,
  toast,
} from '../components/ui';
import { ROLE_LABEL, ROLE_BADGE, isManager } from '../lib/constants';
import { EmptyInbox } from '../components/illustrations';

// Quick actions per role
const QUICK_ACTIONS = {
  ADMIN: [
    {
      icon: '👥',
      label: 'How do I add a new user?',
      prompt:
        'Walk me through creating a new user in Quintern — what roles are available and what permissions does each have?',
    },
    {
      icon: '📊',
      label: 'Summarize org attendance',
      prompt:
        'Give me a 3-bullet summary of the last 30 days of attendance across all departments.',
    },
    {
      icon: '📈',
      label: 'Top performers report',
      prompt:
        'Who are the top 5 performing interns by average rating, and what stands out about their performance?',
    },
    {
      icon: '🔍',
      label: 'Audit log exploration',
      prompt:
        'How can I use the audit log to track sensitive actions? Show me the most useful filters.',
    },
    {
      icon: '⚠️',
      label: 'Identify at-risk interns',
      prompt:
        'Which interns have attendance below 70% or no recent activity? Give me a list with the data I should consider.',
    },
  ],
  SENIOR_TL: [
    {
      icon: '👥',
      label: 'How do I add a new team member?',
      prompt:
        'Walk me through creating a new team member under my management. What roles can I create?',
    },
    {
      icon: '📊',
      label: 'My team summary',
      prompt:
        'Give me a quick summary of my team — total members, average attendance, and any concerns.',
    },
    {
      icon: '⭐',
      label: 'Best rating practices',
      prompt:
        'What are the best practices for rating team members on the 1-10 scale?',
    },
    {
      icon: '📅',
      label: 'Mark team attendance',
      prompt:
        'How do I mark attendance for multiple team members at once? Show me the bulk attendance workflow.',
    },
  ],
  TL: [
    {
      icon: '⭐',
      label: 'Rate my team',
      prompt:
        'How do I submit ratings for my team members? What categories are available?',
    },
    {
      icon: '📅',
      label: 'Mark attendance',
      prompt:
        'How do I mark attendance for a team member? Show me the available status options.',
    },
    {
      icon: '📋',
      label: 'View team performance',
      prompt:
        "Give me an overview of my team's performance — ratings, attendance, and recent activity.",
    },
  ],
  CAPTAIN: [
    {
      icon: '👥',
      label: 'My interns',
      prompt:
        'Who are the interns reporting to me? Give me a quick overview of their current status.',
    },
    {
      icon: '⭐',
      label: 'Rate my interns',
      prompt:
        'How do I rate my interns? Walk me through the 1-10 rating system.',
    },
  ],
  INTERN: [
    {
      icon: '📅',
      label: 'My attendance',
      prompt:
        'How can I check my attendance record? Where do I find my monthly summary?',
    },
    {
      icon: '⭐',
      label: 'My ratings',
      prompt: "Where can I see the ratings I've received from my team lead?",
    },
    {
      icon: '📋',
      label: 'Upload a proof',
      prompt:
        'How do I upload a proof for a social media task? What image formats are supported?',
    },
  ],
};

const SUGGESTED_PROMPTS = [
  {
    icon: '✨',
    label: 'What can you help me with?',
    prompt:
      'Give me a 3-bullet overview of the most important things I can do in Quintern today.',
  },
  {
    icon: '📈',
    label: 'How are my projects going?',
    prompt:
      'Show me a health summary of all my active projects, highlighting any risks.',
  },
  {
    icon: '💡',
    label: 'Productivity tips',
    prompt: 'What are the top 3 productivity tips for interns using Quintern?',
  },
];

function renderMarkdown(text = '') {
  // Tiny markdown renderer: handles **bold**, *italic*, `code`, line breaks, lists.
  // Avoids the bundle weight of a full library while staying safe (escapes HTML).
  const lines = text.split('\n');
  const out = [];
  let inList = false;
  let listItems = [];
  const flushList = () => {
    if (listItems.length) {
      out.push(
        <ul
          key={`ul-${out.length}`}
          className="my-1 ml-4 list-disc space-y-0.5"
        >
          {listItems.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*[-*]\s+/.test(l)) {
      inList = true;
      listItems.push(l.replace(/^\s*[-*]\s+/, ''));
      continue;
    }
    flushList();
    if (l.trim() === '') {
      out.push(<br key={`br-${i}`} />);
      continue;
    }
    if (/^#\s/.test(l))
      out.push(
        <h2 key={i} className="text-base font-semibold text-fg mt-1 mb-1">
          {renderInline(l.slice(2))}
        </h2>
      );
    else if (/^##\s/.test(l))
      out.push(
        <h3 key={i} className="text-sm font-semibold text-fg mt-1 mb-1">
          {renderInline(l.slice(3))}
        </h3>
      );
    else
      out.push(
        <p key={i} className="my-1 leading-relaxed">
          {renderInline(l)}
        </p>
      );
  }
  flushList();
  return out;
}
function renderInline(text) {
  // Escape HTML first.
  const safe = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const parts = [];
  let i = 0;
  let key = 0;
  // Match **bold**, *italic*, `code`
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/;
  const tokens = safe.split(re);
  for (const t of tokens) {
    if (!t) continue;
    if (/^\*\*[^*]+\*\*$/.test(t))
      parts.push(
        <strong key={key++} className="font-semibold text-fg">
          {t.slice(2, -2)}
        </strong>
      );
    else if (/^\*[^*]+\*$/.test(t))
      parts.push(<em key={key++}>{t.slice(1, -1)}</em>);
    else if (/^`[^`]+`$/.test(t))
      parts.push(
        <code
          key={key++}
          className="font-mono text-[12px] bg-surface-sunken px-1 py-0.5 rounded"
        >
          {t.slice(1, -1)}
        </code>
      );
    else parts.push(<span key={key++}>{t}</span>);
  }
  return parts;
}

function MessageBubble({ role, content, provider, latencyMs, ts }) {
  const isUser = role === 'user';
  const me = useAuthStore((s) => s.user);
  const time = ts ? new Date(ts) : null;
  return (
    <div
      className={cx(
        'flex gap-3 animate-fade-in-up',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {isUser ? (
        <Avatar
          name={me?.fullName || me?.email}
          size="sm"
          className="shrink-0 mt-1"
        />
      ) : (
        <div className="shrink-0 mt-1 w-8 h-8 rounded-md bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center text-white shadow-sm">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
          </svg>
        </div>
      )}
      <div
        className={cx(
          'min-w-0 max-w-[85%] sm:max-w-[75%]',
          isUser ? 'text-right' : 'text-left'
        )}
      >
        <div
          className={cx(
            'rounded-lg px-3.5 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-brand-600 text-white'
              : 'bg-surface-raised border border-border text-fg'
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{content}</div>
          ) : (
            <div className="chat-markdown break-words">
              {renderMarkdown(content)}
            </div>
          )}
        </div>
        <div
          className={cx(
            'flex items-center gap-1.5 mt-1 text-[10px] text-fg-muted',
            isUser ? 'justify-end' : 'justify-start'
          )}
        >
          {time && (
            <span>
              {time.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          {!isUser && provider && (
            <span>
              · via {provider}
              {latencyMs ? ` · ${latencyMs}ms` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function cx(...parts) {
  return parts.flat(Infinity).filter(Boolean).join(' ');
}

export default function Assistant() {
  const { user } = useAuthStore();
  const role = user?.role || 'INTERN';
  const qc = useQueryClient();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  // Pre-fetch AI insights so we can show them as a sidebar
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['aiInsights'],
    queryFn: () =>
      api
        .get('/ai/insights')
        .then((r) => r.data)
        .catch(() => null),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const send = useCallback(
    async (text) => {
      const msg = (text ?? input).trim();
      if (!msg || sending) return;
      setInput('');
      setMessages((m) => [
        ...m,
        { role: 'user', content: msg, ts: Date.now() },
      ]);
      setSending(true);
      try {
        // Map internal 'bot' role to API's 'assistant' role
        const apiHistory = messages.slice(-6).map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));
        const res = await api.post('/ai/assistant', {
          message: msg,
          role,
          history: apiHistory,
        });
        const answer = res.data?.answer || 'No response received.';
        const provider = res.data?.provider || 'ai';
        const latency = res.data?.latencyMs || 0;
        setMessages((m) => [
          ...m,
          {
            role: 'bot',
            content: answer,
            provider,
            latencyMs: latency,
            ts: Date.now(),
          },
        ]);
      } catch (err) {
        const detail = err.response?.data?.error;
        const fallback =
          '⚠️ AI is temporarily unavailable. Try again in a moment, or use the search at the top to find what you need.';
        setMessages((m) => [
          ...m,
          {
            role: 'bot',
            content: detail ? `${detail}\n\n${fallback}` : fallback,
            provider: 'error',
            ts: Date.now(),
          },
        ]);
      } finally {
        setSending(false);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    },
    [input, sending, messages, role]
  );

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const quickActions = QUICK_ACTIONS[role] || SUGGESTED_PROMPTS;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 -mt-2 -mx-2">
      {/* Chat column */}
      <Card className="flex flex-col h-[calc(100vh-9rem)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3 bg-surface-raised">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-9 h-9 rounded-md bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center text-white shadow-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-fg truncate">
                Quintern AI
              </h2>
              <p className="text-[11px] text-fg-muted truncate">
                {role === 'INTERN'
                  ? 'Your personal assistant'
                  : 'Role-aware assistant'}{' '}
                · Anthropic · Groq · DeepSeek · Gemini · HF
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <Button size="xs" variant="ghost" onClick={() => setMessages([])}>
                Clear chat
              </Button>
            )}
            <Badge tone="brand" size="sm" dot>
              Beta
            </Badge>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-surface-base/30">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 mb-4 animate-glow">
                <svg
                  className="w-8 h-8"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-fg tracking-tight">
                How can I help today,{' '}
                {user?.fullName?.split(/\s+/)[0] || 'there'}?
              </h3>
              <p className="text-sm text-fg-muted mt-1.5 max-w-md">
                Ask anything about your workspace, projects, attendance, or
                platform usage. I'll route the request to the best available
                model.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-2xl">
                {quickActions.slice(0, 6).map((a) => (
                  <button
                    key={a.label}
                    onClick={() => send(a.prompt)}
                    className="group flex items-start gap-2.5 text-left px-3 py-2.5 rounded-md border border-border bg-surface-raised hover:border-border-strong hover:bg-surface-sunken transition-all"
                  >
                    <span
                      className="text-lg shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      {a.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-fg">
                        {a.label}
                      </span>
                    </span>
                    <svg
                      className="w-3.5 h-3.5 text-fg-muted shrink-0 mt-1 group-hover:translate-x-0.5 group-hover:text-fg transition-all"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <MessageBubble key={i} {...m} />
              ))}
              {sending && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="shrink-0 mt-1 w-8 h-8 rounded-md bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center text-white shadow-sm">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
                    </svg>
                  </div>
                  <div className="rounded-lg px-3.5 py-2.5 bg-surface-raised border border-border flex items-center gap-2">
                    <span className="flex gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce"
                        style={{ animationDelay: '120ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce"
                        style={{ animationDelay: '240ms' }}
                      />
                    </span>
                    <span className="text-xs text-fg-muted">Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </>
          )}
        </div>

        {/* Composer */}
        <div className="px-4 py-3 border-t border-border bg-surface-raised">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder={`Ask anything as ${ROLE_LABEL[role] || role}…`}
                rows={1}
                className="w-full resize-none rounded-md border border-border bg-surface-base px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors"
                style={{ maxHeight: 160 }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height =
                    Math.min(e.target.scrollHeight, 160) + 'px';
                }}
              />
            </div>
            <Button
              onClick={() => send()}
              loading={sending}
              disabled={!input.trim() || sending}
              variant="primary"
              size="md"
              aria-label="Send message"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-fg-muted">
            Press{' '}
            <kbd className="px-1 py-0.5 rounded bg-surface-sunken border border-border">
              Enter
            </kbd>{' '}
            to send ·{' '}
            <kbd className="px-1 py-0.5 rounded bg-surface-sunken border border-border">
              Shift + Enter
            </kbd>{' '}
            for newline. Responses are streamed from a multi-provider fallback
            chain.
          </p>
        </div>
      </Card>

      {/* Sidebar — quick actions + insights */}
      <aside className="space-y-4">
        <Card>
          <CardHeader title="Quick actions" subtitle="Tap to ask" />
          <CardBody className="!p-2 space-y-0.5">
            {(QUICK_ACTIONS[role] || SUGGESTED_PROMPTS).map((a) => (
              <button
                key={a.label}
                onClick={() => send(a.prompt)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-sm text-fg hover:bg-surface-sunken transition-colors group"
              >
                <span className="text-base shrink-0" aria-hidden="true">
                  {a.icon}
                </span>
                <span className="flex-1 truncate">{a.label}</span>
                <svg
                  className="w-3 h-3 text-fg-muted group-hover:translate-x-0.5 transition-all"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </button>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Live insights"
            subtitle="Auto-generated for your role"
          />
          <CardBody>
            {insightsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
              </div>
            ) : insights?.answer ? (
              <div className="text-sm text-fg leading-relaxed whitespace-pre-line chat-markdown">
                {renderMarkdown(insights.answer)}
              </div>
            ) : (
              <EmptyState
                illustration={<EmptyInbox />}
                title="No insights yet"
                description="Insights appear here once you have activity on the platform."
                className="py-6"
              />
            )}
            {insights?.provider && (
              <p className="mt-2 pt-2 border-t border-border text-[10px] text-fg-muted">
                via {insights.provider}
                {insights.latencyMs ? ` · ${insights.latencyMs}ms` : ''}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Useful links" />
          <CardBody className="!p-2 space-y-0.5">
            <Link
              to="/"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-fg hover:bg-surface-sunken"
            >
              <svg
                className="w-4 h-4 text-fg-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9.5z" />
              </svg>
              Dashboard
            </Link>
            <Link
              to="/projects"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-fg hover:bg-surface-sunken"
            >
              <svg
                className="w-4 h-4 text-fg-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 7v10M15 7v6" />
              </svg>
              Projects
            </Link>
            <Link
              to="/attendance"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-fg hover:bg-surface-sunken"
            >
              <svg
                className="w-4 h-4 text-fg-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              Attendance
            </Link>
            <Link
              to="/profile"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-fg hover:bg-surface-sunken"
            >
              <svg
                className="w-4 h-4 text-fg-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Profile
            </Link>
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}
