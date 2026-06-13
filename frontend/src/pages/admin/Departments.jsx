import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/axios'
import { Banner, Button, Card, CardBody, ConfirmDialog, EmptyState, Input, Skeleton } from '../../components/ui'
import { useFlash } from '../../lib/useFlash'
import { formatDate } from '../../lib/format'
import { EmptyBuildings } from '../../components/illustrations'

const GRADIENTS = [
  'from-brand-500 to-violet-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-fuchsia-500 to-pink-600',
  'from-sky-500 to-cyan-600',
  'from-rose-500 to-pink-600',
];

export default function Departments() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const { message, error, flash, flashError } = useFlash(3000)

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
  })

  const inv = () => queryClient.invalidateQueries({ queryKey: ['departments'] })
  const createMut = useMutation({
    mutationFn: (n) => api.post('/departments', { name: n }),
    onSuccess: () => { setName(''); flash('Department created'); inv() },
    onError: (err) => flashError(err.response?.data?.error || 'Failed to create'),
  })
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/departments/${id}`),
    onSuccess: () => { inv(); flash('Department deleted') },
    onError: (err) => flashError(err.response?.data?.error || 'Failed to delete'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Departments</h1>
        <p className="text-sm text-fg-muted mt-1">Organize your workforce into teams.</p>
      </div>

      {message && <Banner kind="success">{message}</Banner>}
      {error && <Banner kind="error">{error}</Banner>}

      <Card>
        <CardBody>
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMut.mutate(name.trim()) }} className="flex gap-3 items-end">
            <div className="flex-1">
              <label htmlFor="dept-name" className="block text-xs font-medium text-fg-muted mb-1.5">Department name</label>
              <Input id="dept-name" placeholder="e.g. Social Media" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" variant="primary" loading={createMut.isPending} disabled={!name.trim()}>Add</Button>
          </form>
        </CardBody>
      </Card>

      {isLoading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0,1,2].map((i) => <Skeleton key={i} className="h-24" />)}</div> : departments.length === 0 ? (
        <EmptyState
          illustration={<EmptyBuildings />}
          title="No departments yet"
          description="Departments organize your workforce into teams. Add one above to get started."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d, i) => (
            <Card key={d.id} className="lift">
              <CardBody className="flex items-center gap-3">
                <div className={['shrink-0 w-12 h-12 rounded-md bg-gradient-to-br flex items-center justify-center text-xl text-white shadow-sm', GRADIENTS[i % GRADIENTS.length]].join(' ')} aria-hidden="true">🏢</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg truncate">{d.name}</p>
                  <p className="text-xs text-fg-muted">Created {d.created_at ? formatDate(d.created_at) : '—'}</p>
                </div>
                <button onClick={() => setConfirmDelete(d)} className="p-1.5 rounded text-fg-muted hover:text-danger-600 hover:bg-danger-50 transition-colors" title="Delete" aria-label={`Delete ${d.name}`}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" /></svg>
                </button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete department?"
        message={confirmDelete ? `Delete "${confirmDelete.name}"? Users in this department will be unassigned.` : ''}
        confirmLabel="Delete" danger
        onConfirm={() => deleteMut.mutate(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
