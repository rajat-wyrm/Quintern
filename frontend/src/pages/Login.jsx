import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import api from '../lib/axios'
import useAuthStore from '../store/auth'
import { Button, Input, Checkbox, toast } from '../components/ui'

// Uptoskills mark — the brand mark used everywhere in the app
function Mark({ size = 'md' }) {
  const dim = size === 'xl' ? 'w-16 h-16' : size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  return (
    <svg viewBox="0 0 40 40" className={dim} aria-hidden="true">
      <defs>
        <linearGradient id="us-login" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(99 102 241)" />
          <stop offset="100%" stopColor="rgb(139 92 246)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="40" height="40" rx="11" fill="url(#us-login)" />
      <path d="M20 8 L30 28 L20 22 L10 28 Z" fill="white" />
    </svg>
  )
}

const FEATURES = [
  { title: 'Cohort operations', desc: 'Plan, run, and graduate interns in one workspace.' },
  { title: 'Live visibility', desc: 'Attendance, ratings, and project status — in real time.' },
  { title: 'Built for scale', desc: 'Designed for hundreds of interns without skipping a beat.' },
  { title: 'Enterprise-grade', desc: 'Granular roles, audit log, encrypted at every layer.' },
]

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)
  const existingToken = useAuthStore((s) => s.accessToken)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  // If already signed in, route to the dashboard immediately.
  useEffect(() => {
    if (existingToken) {
      const to = new URLSearchParams(location.search).get('next') || '/'
      navigate(to, { replace: true })
    }
  }, [existingToken, location.search, navigate])

  // Friendly session-expired banner
  useEffect(() => {
    if (new URLSearchParams(location.search).get('reason') === 'expired') {
      setError('Your session expired. Please sign in again.')
    }
  }, [location.search])

  const loginMut = useMutation({
    mutationFn: (creds) => api.post('/auth/login', creds).then((res) => res.data),
    onSuccess: (data) => {
      if (!data?.accessToken) {
        setError('Unexpected response. Please try again.')
        return
      }
      setAuth({ accessToken: data.accessToken, user: data.user })
      const hour = new Date().getHours()
      const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
      const firstName = (data.user?.fullName || data.user?.email || 'there').split(/\s+/)[0]
      toast({ kind: 'success', title: `${greeting}, ${firstName}!`, description: 'Signed in to Uptoskills.' })
      const to = new URLSearchParams(location.search).get('next') || '/'
      // Defer navigation so the toast + state flush commit first.
      setTimeout(() => navigate(to, { replace: true }), 50)
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Sign in failed. Check your credentials and try again.')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please enter both email and password.'); return }
    loginMut.mutate({ email: email.trim(), password, remember })
  }

  return (
    <div className="min-h-screen flex items-stretch bg-surface-base">
      {/* LEFT — brand hero (desktop only) */}
      <aside className="relative hidden lg:flex flex-col justify-between flex-1 max-w-xl xl:max-w-2xl p-10 xl:p-16 bg-fg text-fg-inverse overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-[0.06]" aria-hidden="true" />
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-brand-500/25 blur-3xl animate-float-blob" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-fuchsia-500/15 blur-3xl animate-float-blob" style={{ animationDelay: '3s' }} aria-hidden="true" />

        <div className="relative z-10 flex items-center gap-2.5">
          <Mark size="lg" />
          <div>
            <div className="text-base font-bold tracking-tight">Uptoskills</div>
            <div className="text-[11px] text-fg-inverse/60">Workforce operations</div>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <h1 className="text-[2.25rem] font-semibold leading-[1.1] tracking-tight">
            Run your intern programs with confidence.
          </h1>
          <p className="text-fg-inverse/70 text-sm leading-relaxed">
            Uptoskills is the home of structured intern programs. Sign in to plan cohorts,
            track attendance, and graduate world-class teams.
          </p>
          <ul className="space-y-2.5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-fg-inverse/12 flex items-center justify-center" aria-hidden="true">
                  <svg className="w-3 h-3 text-fg-inverse" viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 4.5L6 12L2.5 8.5L3.91 7.09L6 9.17L12.09 3.09L13.5 4.5Z" /></svg>
                </span>
                <span className="text-sm text-fg-inverse/85"><span className="text-fg-inverse font-medium">{f.title}</span> · {f.desc}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-xs text-fg-inverse/50">
          <span>© {new Date().getFullYear()} Uptoskills</span>
          <span aria-hidden="true">·</span>
          <span>All systems operational</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-soft" /> Secure session
          </span>
        </div>
      </aside>

      {/* RIGHT — form */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-8 md:p-12 mesh-gradient min-h-screen">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <Mark size="lg" />
            <div className="text-left">
              <div className="text-base font-bold text-fg tracking-tight">Uptoskills</div>
              <div className="text-[10px] text-fg-muted">Workforce operations</div>
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-semibold text-fg tracking-tight">Welcome back</h2>
            <p className="text-sm text-fg-muted mt-1.5">Sign in to your Uptoskills workspace</p>
          </div>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-md border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 px-3.5 py-2.5 text-sm animate-fade-in">
              <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" /></svg>
              <span className="flex-1">{error}</span>
              <button onClick={() => setError('')} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.11.05 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg></button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Work email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder="you@uptoskills.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6L12 13 2 6" /></svg>}
            />
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>}
              rightIcon={
                <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="text-fg-subtle hover:text-fg-muted">
                  {showPassword
                    ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><path d="M1 1l22 22" /></svg>
                    : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
                </button>
              }
            />
            <div className="flex items-center justify-between">
              <Checkbox id="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} label="Remember me" />
              <Link to="/forgot-password" className="text-xs font-medium text-fg-muted hover:text-fg transition-colors">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" variant="primary" size="lg" loading={loginMut.isPending} className="w-full" disabled={loginMut.isPending}>
              {loginMut.isPending ? 'Signing in…' : 'Sign in securely'}
            </Button>
          </form>

          <details className="mt-6 text-xs text-fg-muted group">
            <summary className="cursor-pointer hover:text-fg transition-colors select-none font-medium list-none flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l4 4-4 4" /></svg>
              Demo credentials
            </summary>
            <div className="mt-2 space-y-1 font-mono text-[11px] bg-surface-sunken rounded-md p-3 border border-border">
              <div><span className="text-fg">admin@internops.com</span> · Admin@123</div>
              <div><span className="text-fg">aanya.s@internops.com</span> · Password@123 (Senior TL)</div>
              <div><span className="text-fg">arjun.n@internops.com</span> · Password@123 (Intern)</div>
            </div>
          </details>

          <p className="mt-8 text-center text-xs text-fg-muted">
            By signing in, you agree to your organization's acceptable-use policy.
          </p>
        </div>
      </main>
    </div>
  )
}
