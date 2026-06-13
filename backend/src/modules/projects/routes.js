'use strict';
const { z } = require('zod');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const { checkHierarchyAccess } = require('../../utils/hierarchy');

// All write paths check ownership/membership in the handler so the route
// table stays thin. RBAC is permissive on read; strict on write.

const PROJECT_ROLES = ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'];

function canManage(role) { return ['ADMIN', 'SENIOR_TL', 'TL'].includes(role); }

async function ensureProjectAccess(projectId, user) {
  if (user.role === 'ADMIN' || user.role === 'SENIOR_TL') return true;
  const p = await repo.getProject(projectId, { id: user.id, role: 'ADMIN' });
  return !!p;
}

async function routes(fastify) {
  // ============ LIST / GET ============

  fastify.get('/', {
    schema: { tags: ['Projects'], description: 'List projects visible to the requester' },
    preHandler: [auth],
  }, async (req, reply) => {
    const schema = z.object({
      status: z.string().optional(),
      health: z.string().optional(),
      search: z.string().max(100).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    });
    const q = schema.safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: 'Bad Request', details: q.error.format() });
    return repo.listProjects({ user: req.user, ...q.data });
  });

  fastify.get('/me', { preHandler: [auth] }, async (req) => {
    return repo.myProjects(req.user.id);
  });

  fastify.get('/me/tasks', { preHandler: [auth] }, async (req) => {
    return repo.myTasks(req.user.id);
  });

  fastify.get('/:id', { preHandler: [auth] }, async (req, reply) => {
    const p = await repo.getProject(req.params.id, req.user);
    if (!p) return reply.status(404).send({ error: 'Project not found' });
    return p;
  });

  // ============ CREATE / UPDATE / DELETE ============

  fastify.post('/', {
    schema: { tags: ['Projects'], description: 'Create project' },
    preHandler: [auth, rbac(...PROJECT_ROLES)],
  }, async (req, reply) => {
    const schema = z.object({
      name: z.string().min(2).max(255),
      description: z.string().max(4000).optional(),
      status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
      health: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      department_id: z.string().uuid().optional(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      member_ids: z.array(z.string().uuid()).max(100).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    const project = await repo.createProject({ ...parsed.data, owner_id: req.user.id });
    await createAuditLog({
      userId: req.user.id, action: 'PROJECT_CREATED', resourceType: 'project', resourceId: project.id,
      details: { name: project.name }, ...extractRequestInfo(req),
    });
    return reply.status(201).send(project);
  });

  fastify.patch('/:id', {
    schema: { tags: ['Projects'], description: 'Update project' },
    preHandler: [auth, rbac(...PROJECT_ROLES)],
  }, async (req, reply) => {
    if (!await ensureProjectAccess(req.params.id, req.user)) {
      return reply.status(403).send({ error: 'No access to this project' });
    }
    const schema = z.object({
      name: z.string().min(2).max(255).optional(),
      description: z.string().max(4000).optional(),
      status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
      health: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      department_id: z.string().uuid().optional(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      progress: z.coerce.number().int().min(0).max(100).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    const updated = await repo.updateProject(req.params.id, parsed.data);
    await createAuditLog({
      userId: req.user.id, action: 'PROJECT_UPDATED', resourceType: 'project', resourceId: req.params.id,
      details: parsed.data, ...extractRequestInfo(req),
    });
    return updated;
  });

  fastify.delete('/:id', {
    preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL')],
  }, async (req, reply) => {
    if (!await ensureProjectAccess(req.params.id, req.user)) {
      return reply.status(403).send({ error: 'No access to this project' });
    }
    await repo.deleteProject(req.params.id);
    await createAuditLog({
      userId: req.user.id, action: 'PROJECT_DELETED', resourceType: 'project', resourceId: req.params.id, ...extractRequestInfo(req),
    });
    return { success: true };
  });

  // ============ TASKS ============

  fastify.post('/:id/tasks', {
    preHandler: [auth, rbac(...PROJECT_ROLES)],
  }, async (req, reply) => {
    if (!await ensureProjectAccess(req.params.id, req.user)) {
      return reply.status(403).send({ error: 'No access to this project' });
    }
    const schema = z.object({
      title: z.string().min(2).max(255),
      description: z.string().max(4000).optional(),
      status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED']).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      assignee_id: z.string().uuid().optional(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      estimated_hours: z.coerce.number().optional(),
      parent_task_id: z.string().uuid().optional(),
      position: z.coerce.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    const task = await repo.addTask(req.params.id, { ...parsed.data, created_by: req.user.id });
    await createAuditLog({
      userId: req.user.id, action: 'TASK_CREATED', resourceType: 'project_task', resourceId: task.id, ...extractRequestInfo(req),
    });
    return reply.status(201).send(task);
  });

  fastify.patch('/tasks/:taskId', {
    preHandler: [auth],
  }, async (req, reply) => {
    const task = await repo.getTask(req.params.taskId);
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    const access = await ensureProjectAccess(task.project_id, req.user);
    if (!access) return reply.status(403).send({ error: 'No access to this task' });
    const schema = z.object({
      title: z.string().min(2).max(255).optional(),
      description: z.string().max(4000).optional(),
      status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED']).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      assignee_id: z.string().uuid().nullable().optional(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      estimated_hours: z.coerce.number().nullable().optional(),
      actual_hours: z.coerce.number().nullable().optional(),
      position: z.coerce.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    const updated = await repo.updateTask(req.params.taskId, parsed.data);
    await createAuditLog({
      userId: req.user.id, action: 'TASK_UPDATED', resourceType: 'project_task', resourceId: req.params.taskId, details: parsed.data, ...extractRequestInfo(req),
    });
    return updated;
  });

  fastify.delete('/tasks/:taskId', {
    preHandler: [auth, rbac(...PROJECT_ROLES)],
  }, async (req, reply) => {
    const task = await repo.getTask(req.params.taskId);
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    if (!await ensureProjectAccess(task.project_id, req.user)) {
      return reply.status(403).send({ error: 'No access' });
    }
    await repo.deleteTask(req.params.taskId);
    await createAuditLog({
      userId: req.user.id, action: 'TASK_DELETED', resourceType: 'project_task', resourceId: req.params.taskId, ...extractRequestInfo(req),
    });
    return { success: true };
  });

  // ============ MILESTONES ============

  fastify.post('/:id/milestones', {
    preHandler: [auth, rbac(...PROJECT_ROLES)],
  }, async (req, reply) => {
    if (!await ensureProjectAccess(req.params.id, req.user)) {
      return reply.status(403).send({ error: 'No access' });
    }
    const schema = z.object({
      name: z.string().min(2).max(255),
      description: z.string().max(2000).optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    return reply.status(201).send(await repo.addMilestone(req.params.id, parsed.data));
  });

  fastify.patch('/milestones/:milestoneId', {
    preHandler: [auth, rbac(...PROJECT_ROLES)],
  }, async (req, reply) => {
    const schema = z.object({
      name: z.string().min(2).max(255).optional(),
      description: z.string().max(2000).optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      completed_at: z.string().datetime().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    const m = await repo.updateMilestone(req.params.milestoneId, parsed.data);
    if (!m) return reply.status(404).send({ error: 'Milestone not found' });
    return m;
  });

  // ============ RISKS ============

  fastify.post('/:id/risks', {
    preHandler: [auth, rbac(...PROJECT_ROLES)],
  }, async (req, reply) => {
    if (!await ensureProjectAccess(req.params.id, req.user)) {
      return reply.status(403).send({ error: 'No access' });
    }
    const schema = z.object({
      title: z.string().min(2).max(255),
      description: z.string().max(2000).optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      mitigation: z.string().max(2000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    return reply.status(201).send(await repo.addRisk(req.params.id, { ...parsed.data, raised_by: req.user.id }));
  });

  fastify.patch('/risks/:riskId', {
    preHandler: [auth, rbac(...PROJECT_ROLES)],
  }, async (req, reply) => {
    const schema = z.object({
      title: z.string().min(2).max(255).optional(),
      description: z.string().max(2000).optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      mitigation: z.string().max(2000).optional(),
      status: z.string().max(20).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    const r = await repo.updateRisk(req.params.riskId, parsed.data);
    if (!r) return reply.status(404).send({ error: 'Risk not found' });
    return r;
  });

  // ============ MEMBERS ============

  fastify.post('/:id/members', {
    preHandler: [auth, rbac(...PROJECT_ROLES)],
  }, async (req, reply) => {
    if (!await ensureProjectAccess(req.params.id, req.user)) {
      return reply.status(403).send({ error: 'No access' });
    }
    const schema = z.object({
      user_id: z.string().uuid(),
      role: z.string().max(50).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    await repo.addMember(req.params.id, parsed.data.user_id, parsed.data.role || 'CONTRIBUTOR');
    return { success: true };
  });

  fastify.delete('/:id/members/:userId', {
    preHandler: [auth, rbac(...PROJECT_ROLES)],
  }, async (req, reply) => {
    if (!await ensureProjectAccess(req.params.id, req.user)) {
      return reply.status(403).send({ error: 'No access' });
    }
    await repo.removeMember(req.params.id, req.params.userId);
    return { success: true };
  });
}

module.exports = routes;
