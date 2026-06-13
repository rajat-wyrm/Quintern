import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Textarea,
  Select,
  Banner,
} from './ui';
import { useFlash } from '../lib/useFlash';
import { PLATFORMS } from '../lib/constants';

export default function CreateTaskForm({ onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    targetPlatform: 'LinkedIn',
    taskLink: '',
    deadline: '',
  });
  const { message, error, flash, flashError } = useFlash(2500);

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setForm({
        title: '',
        description: '',
        targetPlatform: 'LinkedIn',
        taskLink: '',
        deadline: '',
      });
      flash('Task created');
      if (onCreated) onCreated();
    },
    onError: (err) =>
      flashError(err.response?.data?.error || 'Failed to create task'),
  });

  return (
    <Card>
      <CardHeader
        title="Create social task"
        subtitle="Reach a platform with a verifiable action."
      />
      <CardBody>
        {message && (
          <Banner kind="success" className="mb-3">
            {message}
          </Banner>
        )}
        {error && (
          <Banner kind="error" className="mb-3">
            {error}
          </Banner>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="space-y-4"
        >
          <Input
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Share Quintern launch post"
          />
          <Textarea
            label="Description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Platform"
              value={form.targetPlatform}
              onChange={(e) =>
                setForm({ ...form, targetPlatform: e.target.value })
              }
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Input
              label="Deadline"
              type="datetime-local"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              required
            />
          </div>
          <Input
            label="Task link (optional)"
            type="url"
            value={form.taskLink}
            onChange={(e) => setForm({ ...form, taskLink: e.target.value })}
            placeholder="https://…"
          />
          <Button
            type="submit"
            variant="primary"
            loading={createMutation.isPending}
          >
            Create task
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
