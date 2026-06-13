import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import { Button, Input, Banner } from '../components/ui'

function UptoskillsMark({ size = 'md' }) {
  const dim = size === 'lg' ? 'w-10 h-10' : 'w-9 h-9'
  return (
    <svg viewBox="0 0 40 40" className={dim} aria-hidden="true">
      <defs>
        <linearGradient id="us-grad-fp" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(99 102 241)" />
          <stop offset="100%" stopColor="rgb(139 92 246)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="40" height="40" rx="10" fill="url(#us-grad-fp)" />
      <path d="M20 8 L30 28 L20 22 L10 28 Z" fill="white" />
    </svg>
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send reset email. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base mesh-gradient p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <UptoskillsMark size="lg" />
          <div>
            <div className="text-base font-bold text-fg tracking-tight">Uptoskills</div>
            <div className="text-[10px] text-fg-muted">InternOps · Workforce Platform</div>
          </div>
        </div>

        <div className="bg-surface-raised border border-border rounded-md shadow-sm p-7">
          <h1 className="text-xl font-semibold text-fg">Reset your password</h1>
          <p className="text-sm text-fg-muted mt-1.5">
            Enter the email associated with your account. We'll send a reset link if the account exists.
          </p>

          {success ? (
            <Banner kind="success" className="mt-5">
              <p className="font-medium">Check your inbox</p>
              <p className="text-xs mt-0.5">If an account exists for {email}, we've sent a reset link.</p>
              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={() => navigate('/login')}>Back to sign in</Button>
              </div>
            </Banner>
          ) : (
            <>
              {error && <Banner kind="error" className="mt-5">{error}</Banner>}
              <form onSubmit={handleSubmit} className="space-y-4 mt-5">
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@uptoskills.com"
                  leftIcon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6L12 13 2 6" /></svg>}
                />
                <Button type="submit" variant="primary" loading={submitting} className="w-full">Send reset link</Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-fg-muted">
            <Link to="/login" className="font-medium text-fg hover:underline">← Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
