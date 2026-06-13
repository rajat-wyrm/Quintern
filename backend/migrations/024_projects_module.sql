-- ============================================================================
-- 024: Project management module
-- ============================================================================
-- Projects, tasks, subtasks, milestones, dependencies, risks, assignments.
-- The shape mirrors SRS §5 (Project Management) and is intentionally
-- denormalized where it would otherwise force 5+ joins on the hot path
-- (e.g. task status, project health denormalized onto the parent).
-- ============================================================================

CREATE TYPE project_status     AS ENUM ('PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED');
CREATE TYPE project_health     AS ENUM ('ON_TRACK','AT_RISK','OFF_TRACK');
CREATE TYPE project_priority   AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE task_status        AS ENUM ('TODO','IN_PROGRESS','BLOCKED','IN_REVIEW','DONE','CANCELLED');
CREATE TYPE task_priority      AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE risk_severity      AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'PLANNING',
  health project_health NOT NULL DEFAULT 'ON_TRACK',
  priority project_priority NOT NULL DEFAULT 'MEDIUM',
  department_id UUID REFERENCES departments(id),
  owner_id UUID NOT NULL REFERENCES users(id),
  start_date DATE,
  due_date DATE,
  progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_due ON projects(due_date);
CREATE INDEX IF NOT EXISTS idx_projects_department ON projects(department_id);

CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(50) NOT NULL DEFAULT 'CONTRIBUTOR',
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'TODO',
  priority task_priority NOT NULL DEFAULT 'MEDIUM',
  assignee_id UUID REFERENCES users(id),
  start_date DATE,
  due_date DATE,
  estimated_hours NUMERIC(6,2),
  actual_hours NUMERIC(6,2),
  position INT NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee ON project_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_parent ON project_tasks(parent_task_id);

CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);

CREATE TABLE IF NOT EXISTS project_task_dependencies (
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id),
  CHECK (task_id <> depends_on_id)
);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends ON project_task_dependencies(depends_on_id);

CREATE TABLE IF NOT EXISTS project_risks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity risk_severity NOT NULL DEFAULT 'MEDIUM',
  mitigation TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  raised_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_project_risks_project ON project_risks(project_id);

CREATE TABLE IF NOT EXISTS project_meeting_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  notes TEXT NOT NULL,
  decisions TEXT,
  action_items JSONB,
  author_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_project_notes_project ON project_meeting_notes(project_id);
