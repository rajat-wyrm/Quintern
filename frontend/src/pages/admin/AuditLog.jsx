import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/axios'
import { Banner, Badge, Button, Card, CardBody, EmptyState, Input, Select, Spinner, Skeleton, SkeletonTable } from '../../components/ui'
import { formatDateTime } from '../../lib/format'
import { EmptyLog } from '../../components/illustrations'

const ACTIONS = [
  'USER_CREATED', 'USER_SUSPENDED', 'USER_ACTIVATED', 'MEMBER_CREATED', 'MEMBER_DETAILS_UPDATED',
  'LOGIN', 'LOGOUT', 'ATTENDANCE_MARKED', 'ATTENDANCE_BULK_MARKED', 'RATING_GIVEN',
  'TASK_CREATED', 'TASK_UPDATED', 'TASK_DELETED', 'PROJECT_CREATED', 'PROJECT_UPDATED',
  'PROOF_SUBMITTED', 'PROOF_VERIFIED', 'PASSWORD_RESET', 'DEPARTMENT_CREATED', 'SESSION_REVOKED',
];

function actionColor(a = '') {
  if (a.includes('DELETE') || a.includes('SUSPEND') || a.includes('TERMINATED')) return 'danger'
  if (a.includes('CREATE') || a.includes('LOGIN') || a.includes('VERIFIED') || a.includes('ACTIVATED')) return 'success'
  if (a.includes('UPDATE') || a.includes('RATING') || a.includes('ATTENDANCE') || a.includes('RESET')) return 'info'
  return 'neutral'
}

export default function AuditLog() {
  const [action, setAction] = useState('')
  const [userId, setUserId] = useState('')
  const [page, setPage] = useState(1)

  const query = new URLSearchParams({ page, limit: '50' })
  if (action) query.set('action', action)
  if (userId) query.set('userId', userId)

  const { data, isLoading, error } = useQuery({
    queryKey: ['auditLogs', action, userId, page],
    queryFn: () => api.get(`/audit?${query.toString()}`).then((res) => res.data),
    refetchInterval: 60000,
  })

  const logs = data?.data || data || []
  const total = data?.total ?? logs.length
  const limit = data?.limit ?? 50
  const lastPage = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Audit Log</h1>
        <p className="text-sm text-fg-muted mt-1">Immutable trail of every sensitive action.</p>
      </div>

      <Card>
        <CardBody className="!py-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="audit-action" className="block text-xs font-medium text-fg-muted mb-1.5">Action</label>
              <Select id="audit-action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }}>
                <option value="">All actions</option>
                {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="audit-user" className="block text-xs font-medium text-fg-muted mb-1.5">Actor ID (UUID)</label>
              <Input id="audit-user" value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1) }} placeholder="Filter by actor UUID" />
            </div>
            <div className="flex items-end text-xs text-fg-muted">{total} entries</div>
          </div>
        </CardBody>
      </Card>

      {error && <Banner kind="error">{error.response?.data?.error || 'Failed to load audit log'}</Banner>}

      {isLoading ? <SkeletonTable rows={10} cols={5} /> : logs.length === 0 ? (
        <EmptyState
          illustration={<EmptyLog />}
          title="No audit entries"
          description="Audit entries appear here as users interact with the platform."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-fg-muted">
                <tr>
                  {['Time', 'Actor', 'Action', 'Resource', 'Details'].map((h) => (
                    <th key={h} className="text-left font-medium text-xs uppercase tracking-wider px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-sunken/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-fg-muted whitespace-nowrap tabular-nums">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-fg-muted">{log.user_id ? log.user_id.substring(0, 8) + '…' : 'system'}</td>
                    <td className="px-4 py-2.5"><Badge size="sm" tone={actionColor(log.action)}>{log.action}</Badge></td>
                    <td className="px-4 py-2.5 text-xs text-fg">{log.resource_type}{log.resource_id ? `/${log.resource_id.substring(0, 8)}…` : ''}</td>
                    <td className="px-4 py-2.5 text-xs text-fg-muted max-w-xs truncate">{log.details ? JSON.stringify(log.details) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > limit && (
            <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-border">
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
              <span className="text-sm text-fg-muted">Page {page} of {lastPage}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= lastPage}>Next</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
