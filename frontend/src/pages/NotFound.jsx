import { Link } from 'react-router-dom'
import { Button } from '../components/ui'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base mesh-gradient p-6">
      <div className="text-center max-w-md">
        <div className="text-7xl font-bold text-fg tracking-tighter tabular-nums">404</div>
        <p className="text-lg font-semibold text-fg mt-4">Page not found</p>
        <p className="text-sm text-fg-muted mt-1.5">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex gap-2 justify-center">
          <Button variant="primary" onClick={() => window.location.href = '/'}>Back to dashboard</Button>
          <Link to="/login" className="px-4 h-9 inline-flex items-center rounded-md border border-border bg-surface-raised text-sm font-medium text-fg hover:bg-surface-sunken transition-colors">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
