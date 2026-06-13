import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/axios'
import { Avatar, Badge, Banner, Button, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, Skeleton, SkeletonTable, toast } from '../../components/ui'
import { initialsOf } from '../../lib/format'
import { useFlash } from '../../lib/useFlash'
import { ROLE_LABEL } from '../../lib/constants'
import { EmptyTeam } from '../../components/illustrations'

const ROLE_COLOR = { ADMIN: 'danger', SENIOR_TL: 'info', TL: 'brand', CAPTAIN: 'success', INTERN: 'neutral' }

export default function AdminDashboard() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const { message, error, flash, flashError } = useFlash(3000)
  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers', page],
    queryFn: () => api.get(`/users?page=${page}&limit=12`).then((res) => res.data),
  })

  const inv = () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
  const suspendMut = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/suspend`),
    onSuccess: () => { inv(); flash('User suspended') },
    onError: (e) => flashError(e.response?.data?.error || 'Failed'),
  })
  const activateMut = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/activate`),
    onSuccess: () => { inv(); flash('User activated') },
    onError: (e) => flashError(e.response?.data?.error || 'Failed'),
  })
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => { inv(); flash('User deleted') },
    onError: (e) => flashError(e.response?.data?.error || 'Failed'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">User Management</h1>
        <p className="text-sm text-fg-muted mt-1">Manage all accounts in the system.</p>
      </div>

      {message && <Banner kind="success">{message}</Banner>}
      {error && <Banner kind="error">{error}</Banner>}

      {isLoading ? <SkeletonTable rows={8} cols={4} /> : !data?.length ? (
        <EmptyState
          illustration={<EmptyTeam />}
          title="No users found"
          description="Create the first account to start using the platform."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-fg-muted">
                <tr>
                  {['User', 'Role', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left font-medium text-xs uppercase tracking-wider px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-sunken/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar user={u} size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-fg truncate">{u.full_name || '—'}</div>
                          <div className="text-xs text-fg-muted truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge size="sm" tone={ROLE_COLOR[u.role] || 'neutral'}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge size="sm" tone={u.suspended ? 'danger' : 'success'} dot>
                        {u.suspended ? 'Suspended' : 'Active'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {u.suspended
                          ? <Button size="sm" variant="primary" onClick={() => activateMut.mutate(u.id)}>Activate</Button>
                          : <Button size="sm" variant="secondary" onClick={() => suspendMut.mutate(u.id)}>Suspend</Button>}
                        <Button size="sm" variant="ghost" className="text-fg-muted hover:text-danger-600" onClick={() => setConfirmDelete(u)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <span className="text-sm text-fg-muted px-2">Page {page}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!data || data.length < 12}>Next</Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete user?"
        message={confirmDelete ? `Permanently delete ${confirmDelete.full_name || confirmDelete.email}? This cannot be undone.` : ''}
        confirmLabel="Delete" danger
        onConfirm={() => deleteMut.mutate(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
