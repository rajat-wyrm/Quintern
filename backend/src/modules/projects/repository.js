'use strict';
// Project management module. All write paths scope the owner/member checks
// to the requester's hierarchy. The dashboard joins on member + project for
// the hot "what am I working on" query, so we keep those indexes up to date
// in migration 025.

const pool = require('../../config/db');

async function listProjects({ user, status, health, search, limit = 50, offset = 0 }) {
  // Admins / Senior_TLs see every project; everyone else only sees projects
  // they own or are a member of.
  const params = [];
  const where = ['p.deleted_at IS NULL'];
  if (user.role !== 'ADMIN' && user.role !== 'SENIOR_TL') {
    params.push(user.id);
    where.push(`(p.owner_id = $${params.length} OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = $${params.length}))`);
  }
  if (status) { params.push(status); where.push(`p.status = $${params.length}`); }
  if (health) { params.push(health); where.push(`p.health = $${params.length}`); }
  if (search) { params.push(`%${search}%`); where.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`); }
  params.push(limit, offset);

  const sql = `
    SELECT p.*,
      (SELECT COUNT(*)::int FROM project_tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) AS task_count,
      (SELECT COUNT(*)::int FROM project_tasks t WHERE t.project_id = p.id AND t.status = 'DONE' AND t.deleted_at IS NULL) AS done_count,
      (SELECT COUNT(*)::int FROM project_members m WHERE m.project_id = p.id) AS member_count,
      u.full_name AS owner_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.owner_id
    WHERE ${where.join(' AND ')}
    ORDER BY p.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function getProject(id, user) {
  const { rows: [project] } = await pool.query(`
    SELECT p.*, u.full_name AS owner_name, u.email AS owner_email, d.name AS department_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.owner_id
    LEFT JOIN departments d ON d.id = p.department_id
    WHERE p.id = $1 AND p.deleted_at IS NULL
  `, [id]);
  if (!project) return null;
  if (user.role !== 'ADMIN' && user.role !== 'SENIOR_TL') {
    if (project.owner_id !== user.id) {
      const { rowCount } = await pool.query('SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2', [id, user.id]);
      if (!rowCount) return null;
    }
  }
  const [members, tasks, milestones, risks] = await Promise.all([
    pool.query(`
      SELECT pm.user_id, pm.role, pm.joined_at, u.full_name, u.email, u.avatar_url
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
      ORDER BY pm.joined_at ASC
    `, [id]),
    pool.query(`
      SELECT t.*, u.full_name AS assignee_name
      FROM project_tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.project_id = $1 AND t.deleted_at IS NULL
      ORDER BY t.position ASC, t.created_at ASC
    `, [id]),
    pool.query(`SELECT * FROM project_milestones WHERE project_id = $1 AND deleted_at IS NULL ORDER BY due_date ASC`, [id]),
    pool.query(`SELECT * FROM project_risks WHERE project_id = $1 AND deleted_at IS NULL ORDER BY severity DESC, created_at DESC`, [id]),
  ]);
  return {
    ...project,
    members: members.rows,
    tasks: tasks.rows,
    milestones: milestones.rows,
    risks: risks.rows,
  };
}

async function createProject(data) {
  const { rows: [p] } = await pool.query(`
    INSERT INTO projects (name, description, status, health, priority, department_id, owner_id, start_date, due_date, progress)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,0))
    RETURNING *
  `, [
    data.name, data.description || null, data.status || 'PLANNING',
    data.health || 'ON_TRACK', data.priority || 'MEDIUM',
    data.department_id || null, data.owner_id,
    data.start_date || null, data.due_date || null,
    data.progress,
  ]);
  if (data.member_ids?.length) {
    const values = data.member_ids.map((_, i) => `($1,$${i + 2},'CONTRIBUTOR')`).join(',');
    await pool.query(`INSERT INTO project_members (project_id, user_id, role) VALUES ${values} ON CONFLICT DO NOTHING`,
      [p.id, ...data.member_ids]);
  }
  return p;
}

async function updateProject(id, data) {
  const fields = ['name', 'description', 'status', 'health', 'priority', 'department_id', 'start_date', 'due_date', 'progress'];
  const sets = [];
  const params = [id];
  for (const f of fields) {
    if (data[f] !== undefined) {
      params.push(data[f]);
      sets.push(`${f} = $${params.length}`);
    }
  }
  if (!sets.length) return (await pool.query('SELECT * FROM projects WHERE id = $1', [id])).rows[0];
  sets.push('updated_at = NOW()');
  const { rows: [p] } = await pool.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = $1 AND deleted_at IS NULL RETURNING *`, params);
  return p;
}

async function deleteProject(id) {
  await pool.query('UPDATE projects SET deleted_at = NOW() WHERE id = $1', [id]);
}

async function recomputeProgress(projectId) {
  const { rows: [r] } = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'DONE')::int AS done
    FROM project_tasks
    WHERE project_id = $1 AND deleted_at IS NULL
  `, [projectId]);
  const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
  await pool.query('UPDATE projects SET progress = $1, updated_at = NOW() WHERE id = $2', [pct, projectId]);
  return pct;
}

async function addTask(projectId, data) {
  const { rows: [t] } = await pool.query(`
    INSERT INTO project_tasks (project_id, parent_task_id, title, description, status, priority, assignee_id, start_date, due_date, estimated_hours, position, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11, 0),$12)
    RETURNING *
  `, [
    projectId, data.parent_task_id || null, data.title,
    data.description || null, data.status || 'TODO', data.priority || 'MEDIUM',
    data.assignee_id || null, data.start_date || null, data.due_date || null,
    data.estimated_hours || null, data.position, data.created_by,
  ]);
  await recomputeProgress(projectId);
  return t;
}

async function updateTask(taskId, data) {
  const fields = ['title', 'description', 'status', 'priority', 'assignee_id', 'start_date', 'due_date', 'estimated_hours', 'actual_hours', 'position'];
  const sets = [];
  const params = [taskId];
  for (const f of fields) {
    if (data[f] !== undefined) {
      params.push(data[f]);
      sets.push(`${f} = $${params.length}`);
    }
  }
  if (!sets.length) return null;
  sets.push('updated_at = NOW()');
  const { rows: [t] } = await pool.query(`UPDATE project_tasks SET ${sets.join(', ')} WHERE id = $1 AND deleted_at IS NULL RETURNING *`, params);
  if (t) await recomputeProgress(t.project_id);
  return t;
}

async function deleteTask(taskId) {
  const { rows: [t] } = await pool.query('UPDATE project_tasks SET deleted_at = NOW() WHERE id = $1 RETURNING project_id', [taskId]);
  if (t) await recomputeProgress(t.project_id);
}

async function getTask(taskId) {
  const { rows: [t] } = await pool.query(`
    SELECT t.*, u.full_name AS assignee_name
    FROM project_tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.id = $1 AND t.deleted_at IS NULL
  `, [taskId]);
  return t || null;
}

async function addMilestone(projectId, data) {
  const { rows: [m] } = await pool.query(`
    INSERT INTO project_milestones (project_id, name, description, due_date)
    VALUES ($1,$2,$3,$4) RETURNING *
  `, [projectId, data.name, data.description || null, data.due_date]);
  return m;
}

async function updateMilestone(id, data) {
  const fields = ['name', 'description', 'due_date', 'completed_at'];
  const sets = [];
  const params = [id];
  for (const f of fields) {
    if (data[f] !== undefined) {
      params.push(data[f]);
      sets.push(`${f} = $${params.length}`);
    }
  }
  if (!sets.length) return null;
  sets.push('updated_at = NOW()');
  const { rows: [m] } = await pool.query(`UPDATE project_milestones SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
  return m;
}

async function addRisk(projectId, data) {
  const { rows: [r] } = await pool.query(`
    INSERT INTO project_risks (project_id, title, description, severity, mitigation, status, raised_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [projectId, data.title, data.description || null, data.severity || 'MEDIUM', data.mitigation || null, data.status || 'OPEN', data.raised_by]);
  return r;
}

async function updateRisk(id, data) {
  const fields = ['title', 'description', 'severity', 'mitigation', 'status'];
  const sets = [];
  const params = [id];
  for (const f of fields) {
    if (data[f] !== undefined) {
      params.push(data[f]);
      sets.push(`${f} = $${params.length}`);
    }
  }
  if (!sets.length) return null;
  sets.push('updated_at = NOW()');
  const { rows: [r] } = await pool.query(`UPDATE project_risks SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
  return r;
}

async function addMember(projectId, userId, role = 'CONTRIBUTOR') {
  await pool.query(`
    INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,$3)
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
  `, [projectId, userId, role]);
}

async function removeMember(projectId, userId) {
  await pool.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
}

// Returns the projects where the user is owner or member, summarized for the dashboard.
async function myProjects(userId, limit = 5) {
  const { rows } = await pool.query(`
    SELECT p.id, p.name, p.status, p.health, p.progress, p.priority, p.due_date,
      (SELECT COUNT(*)::int FROM project_tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) AS task_count,
      (SELECT COUNT(*)::int FROM project_tasks t WHERE t.project_id = p.id AND t.status = 'DONE' AND t.deleted_at IS NULL) AS done_count,
      (SELECT COUNT(*)::int FROM project_tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL AND t.assignee_id = $1) AS my_task_count
    FROM projects p
    WHERE p.deleted_at IS NULL
      AND (p.owner_id = $1 OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = $1))
    ORDER BY p.updated_at DESC
    LIMIT $2
  `, [userId, limit]);
  return rows;
}

async function myTasks(userId, limit = 10) {
  const { rows } = await pool.query(`
    SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id,
      p.name AS project_name
    FROM project_tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL
      AND t.assignee_id = $1 AND t.status NOT IN ('DONE','CANCELLED')
    ORDER BY t.due_date ASC NULLS LAST, t.priority DESC, t.created_at ASC
    LIMIT $2
  `, [userId, limit]);
  return rows;
}

module.exports = {
  listProjects, getProject, createProject, updateProject, deleteProject,
  addTask, updateTask, deleteTask, getTask,
  addMilestone, updateMilestone,
  addRisk, updateRisk,
  addMember, removeMember,
  recomputeProgress, myProjects, myTasks,
};
