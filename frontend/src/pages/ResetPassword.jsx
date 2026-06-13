import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/axios';
import { Button, Input, Banner } from '../components/ui';

function QuinternMark({ size = 'md' }) {
  const dim = size === 'lg' ? 'w-10 h-10' : 'w-9 h-9';
  return (
    <svg viewBox="0 0 40 40" className={dim} aria-hidden="true">
      <defs>
        <linearGradient id="us-grad-rp" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(99 102 241)" />
          <stop offset="100%" stopColor="rgb(139 92 246)" />
        </linearGradient>
      </defs>
      <rect
        x="0"
        y="0"
        width="40"
        height="40"
        rx="10"
        fill="url(#us-grad-rp)"
      />
      <path d="M20 8 L30 28 L20 22 L10 28 Z" fill="white" />
    </svg>
  );
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token)
      setError('Invalid or missing reset token. Use the link from your email.');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Could not reset password. The link may have expired.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base mesh-gradient p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <QuinternMark size="lg" />
          <div>
            <div className="text-base font-bold text-fg tracking-tight">
              Quintern
            </div>
            <div className="text-[10px] text-fg-muted">
              Quintern · Workforce Platform
            </div>
          </div>
        </div>

        <div className="bg-surface-raised border border-border rounded-md shadow-sm p-7">
          <h1 className="text-xl font-semibold text-fg">
            Choose a new password
          </h1>
          <p className="text-sm text-fg-muted mt-1.5">
            Enter a new password for your account. Must be at least 8
            characters.
          </p>

          {success ? (
            <Banner kind="success" className="mt-5">
              <p className="font-medium">Password updated</p>
              <p className="text-xs mt-0.5">Redirecting you to sign in…</p>
            </Banner>
          ) : (
            <>
              {error && (
                <Banner kind="error" className="mt-5">
                  {error}
                </Banner>
              )}
              <form onSubmit={handleSubmit} className="space-y-4 mt-5">
                <Input
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  leftIcon={
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  }
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  leftIcon={
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  }
                />
                <Button
                  type="submit"
                  variant="primary"
                  loading={submitting}
                  className="w-full"
                >
                  Reset password
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-fg-muted">
            <Link to="/login" className="font-medium text-fg hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
