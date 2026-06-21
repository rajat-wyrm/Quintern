import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import CreateTaskForm from '../components/CreateTaskForm';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Modal,
  Spinner,
  toast,
  Skeleton,
} from '../components/ui';
import { PLATFORM_ICON, PROOF_STATUS, isManager } from '../lib/constants';
import { formatDateTime } from '../lib/format';
import { useFlash } from '../lib/useFlash';
import { EmptyTasks, EmptyCalendar } from '../components/illustrations';

const PROOF_TONE = {
  PENDING: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
};

export default function Tasks() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const fileInputRef = useRef(null);
  const { message, error, flash, flashError } = useFlash(3000);

  const canCreateTask = user?.role === 'ADMIN' || user?.role === 'SENIOR_TL';
  const canVerify = isManager(user?.role) && user?.role !== 'INTERN';
  const isIntern = user?.role === 'INTERN';

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get('/tasks').then((res) => res.data),
  });
  const { data: proofs, refetch: refetchProofs } = useQuery({
    queryKey: ['proofs', selectedTask],
    queryFn: () =>
      api.get(`/proofs/task/${selectedTask}`).then((res) => res.data),
    enabled: !!selectedTask,
  });

  const submitMutation = useMutation({
    mutationFn: ({ taskId, file }) => {
      const form = new FormData();
      form.append('task_id', taskId);
      form.append('image', file);
      return api.post('/proofs/submit', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      refetchProofs();
      queryClient.invalidateQueries({ queryKey: ['proofs'] });
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      flash('Proof submitted');
    },
    onError: (e) => flashError(e.response?.data?.error || 'Upload failed'),
  });
  const verifyMutation = useMutation({
    mutationFn: (proofId) => api.patch(`/proofs/${proofId}/verify`),
    onSuccess: () => {
      refetchProofs();
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      flash('Proof verified');
    },
    onError: (e) => flashError(e.response?.data?.error || 'Verify failed'),
  });
  const deleteTaskMut = useMutation({
    mutationFn: (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      flash('Task deleted');
      setConfirmDeleteTask(null);
    },
    onError: (e) => flashError(e.response?.data?.error || 'Failed to delete'),
  });

  const handleUpload = (e, taskId) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      flashError('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      flashError('File size must be under 5MB');
      return;
    }
    submitMutation.mutate({ taskId, file });
  };

  const overdue = (d) => new Date(d) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            Social Media Tasks
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Campaigns, proofs, and verification.
          </p>
        </div>
        {canCreateTask && (
          <Button
            variant="primary"
            onClick={() => setShowForm((s) => !s)}
            leftIcon={
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            }
          >
            {showForm ? 'Close' : 'New task'}
          </Button>
        )}
      </div>

      {message && <Banner kind="success">{message}</Banner>}
      {error && <Banner kind="error">{error}</Banner>}

      {showForm && canCreateTask && (
        <CreateTaskForm onCreated={() => setShowForm(false)} />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody className="space-y-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : !tasks?.length ? (
        <EmptyState
          illustration={<EmptyTasks />}
          title="No tasks yet"
          description={
            canCreateTask
              ? 'Create a social media campaign to start collecting verifiable proofs.'
              : 'New tasks will appear here once your team lead creates one.'
          }
          action={
            canCreateTask && (
              <Button
                variant="primary"
                onClick={() => setShowForm(true)}
                leftIcon={
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                }
              >
                Create task
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tasks.map((t) => {
            const isOverdue = t.deadline && overdue(t.deadline);
            return (
              <Card key={t.id} className="lift">
                <CardBody>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white flex items-center justify-center text-lg">
                      {PLATFORM_ICON[t.target_platform] || '🎯'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-fg truncate">
                          {t.title}
                        </h3>
                        {t.target_platform && (
                          <Badge size="sm" tone="brand">
                            {t.target_platform}
                          </Badge>
                        )}
                        {t.deadline && (
                          <Badge
                            size="sm"
                            tone={isOverdue ? 'danger' : 'success'}
                            dot
                          >
                            {isOverdue ? 'Overdue' : 'Active'}
                          </Badge>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-sm text-fg-muted mt-1.5 line-clamp-2">
                          {t.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-fg-muted">
                        {t.task_link && /^https?:\/\//i.test(t.task_link) && (
                          <a
                            href={t.task_link}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-brand-600 hover:underline"
                          >
                            Task link ↗
                          </a>
                        )}
                        {t.deadline && (
                          <span>⏰ {formatDateTime(t.deadline)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                    {canVerify && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setSelectedTask(selectedTask === t.id ? null : t.id)
                        }
                      >
                        {selectedTask === t.id ? 'Hide proofs' : 'View proofs'}
                      </Button>
                    )}
                    {isIntern && (
                      <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold bg-fg text-fg-inverse hover:bg-fg/90 cursor-pointer transition-colors">
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        Upload proof
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          aria-label={`Upload proof for ${t.title}`}
                          onChange={(e) => handleUpload(e, t.id)}
                        />
                      </label>
                    )}
                    {canCreateTask && t.created_by === user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-fg-muted hover:text-danger-600"
                        onClick={() => setConfirmDeleteTask(t)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>

                  {selectedTask === t.id && (
                    <div className="mt-4 pt-4 border-t border-border space-y-2 animate-fade-in">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                        Submissions
                      </h4>
                      {!proofs?.length ? (
                        <p className="text-xs text-fg-muted">
                          No submissions yet.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {proofs.map((p) => (
                            <div
                              key={p.id}
                              className="group relative rounded-md border border-border overflow-hidden bg-surface-base"
                            >
                              <button
                                onClick={() => setLightbox(p)}
                                className="block w-full"
                              >
                                {p.image_path ? (
                                  <img
                                    src={
                                      '/api/uploads/file/' +
                                      p.image_path.split('/').pop()
                                    }
                                    alt={`Proof for ${t.title}`}
                                    className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-200"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full aspect-square bg-surface-sunken flex items-center justify-center text-fg-subtle text-xs">
                                    No image
                                  </div>
                                )}
                              </button>
                              <div className="p-2 flex items-center justify-between gap-2">
                                <Badge
                                  size="sm"
                                  tone={PROOF_TONE[p.status]}
                                  dot
                                >
                                  {p.status}
                                </Badge>
                                {canVerify &&
                                  p.status === PROOF_STATUS.PENDING && (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      className="h-6 px-2 text-[10px]"
                                      onClick={() =>
                                        verifyMutation.mutate(p.id)
                                      }
                                    >
                                      Verify
                                    </Button>
                                  )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteTask}
        title="Delete task?"
        message={
          confirmDeleteTask
            ? `Permanently delete "${confirmDeleteTask.title}"? Submissions are kept but the task itself will be gone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteTaskMut.mutate(confirmDeleteTask.id)}
        onClose={() => setConfirmDeleteTask(null)}
      />

      {/* Lightbox for proof image */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-fg/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Proof preview"
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface-raised/10 text-fg-inverse flex items-center justify-center hover:bg-surface-raised/20 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
          {lightbox.image_path && (
            <img
              src={'/api/uploads/file/' + lightbox.image_path.split('/').pop()}
              alt="Proof"
              className="max-w-[90vw] max-h-[90vh] rounded-md shadow-2xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-surface-raised rounded-md px-3 py-1.5 text-xs text-fg shadow-lg flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Badge size="sm" tone={PROOF_TONE[lightbox.status]} dot>
              {lightbox.status}
            </Badge>
            <span>{lightbox.intern_name || 'Intern'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
