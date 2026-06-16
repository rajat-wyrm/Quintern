// =============================================================================
// Quintern · Comprehensive seed script (matches actual schema)
// Creates full demo: one user per role + dept + project + tasks + meeting +
// attendance + ratings + notifications. Idempotent on email.
// =============================================================================
require('dotenv').config();
const pool = require('../src/config/db');
const argon2 = require('argon2');

const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Quintern@2026';

const USERS = [
  {
    email: 'admin@quintern.com',
    full_name: 'System Admin',
    role: 'ADMIN',
    phone: '+91-9000000001',
  },
  {
    email: 'priya.senior@quintern.com',
    full_name: 'Priya Sharma',
    role: 'SENIOR_TL',
    phone: '+91-9000000002',
  },
  {
    email: 'arjun.senior@quintern.com',
    full_name: 'Arjun Mehta',
    role: 'SENIOR_TL',
    phone: '+91-9000000003',
  },
  {
    email: 'neha.tl@quintern.com',
    full_name: 'Neha Verma',
    role: 'TL',
    phone: '+91-9000000004',
  },
  {
    email: 'rahul.tl@quintern.com',
    full_name: 'Rahul Iyer',
    role: 'TL',
    phone: '+91-9000000005',
  },
  {
    email: 'kavya.tl@quintern.com',
    full_name: 'Kavya Reddy',
    role: 'TL',
    phone: '+91-9000000006',
  },
  {
    email: 'vikram.cap@quintern.com',
    full_name: 'Vikram Singh',
    role: 'CAPTAIN',
    phone: '+91-9000000007',
  },
  {
    email: 'isha.cap@quintern.com',
    full_name: 'Isha Patel',
    role: 'CAPTAIN',
    phone: '+91-9000000008',
  },
  {
    email: 'rohan.cap@quintern.com',
    full_name: 'Rohan Das',
    role: 'CAPTAIN',
    phone: '+91-9000000009',
  },
  {
    email: 'meera.cap@quintern.com',
    full_name: 'Meera Nair',
    role: 'CAPTAIN',
    phone: '+91-9000000010',
  },
  {
    email: 'aarav.intern@quintern.com',
    full_name: 'Aarav Kumar',
    role: 'INTERN',
    phone: '+91-9000000011',
  },
  {
    email: 'ananya.intern@quintern.com',
    full_name: 'Ananya Joshi',
    role: 'INTERN',
    phone: '+91-9000000012',
  },
  {
    email: 'dev.intern@quintern.com',
    full_name: 'Dev Kapoor',
    role: 'INTERN',
    phone: '+91-9000000013',
  },
  {
    email: 'isha.intern@quintern.com',
    full_name: 'Isha Gupta',
    role: 'INTERN',
    phone: '+91-9000000014',
  },
  {
    email: 'karan.intern@quintern.com',
    full_name: 'Karan Malhotra',
    role: 'INTERN',
    phone: '+91-9000000015',
  },
  {
    email: 'tanvi.intern@quintern.com',
    full_name: 'Tanvi Bhatt',
    role: 'INTERN',
    phone: '+91-9000000016',
  },
];

const DEPARTMENTS = [
  { name: 'Engineering', description: 'Product engineering & platform' },
  { name: 'Design', description: 'Product design & brand' },
  { name: 'Growth', description: 'Marketing, sales & partnerships' },
];

async function hash(p) {
  return argon2.hash(p, { type: argon2.argon2id });
}

async function ensureDepartment(c, name, description) {
  const r = await c.query(
    'SELECT id FROM departments WHERE name=$1 AND deleted_at IS NULL',
    [name]
  );
  if (r.rowCount > 0) return r.rows[0].id;
  const i = await c.query(
    'INSERT INTO departments (name) VALUES ($1) RETURNING id',
    [name]
  );
  return i.rows[0].id;
}

async function ensureUser(c, u) {
  const r = await c.query(
    'SELECT id FROM users WHERE email=$1 AND deleted_at IS NULL',
    [u.email]
  );
  if (r.rowCount > 0) return { id: r.rows[0].id, created: false };
  const h = await hash(SEED_PASSWORD);
  const i = await c.query(
    'INSERT INTO users (email, password_hash, role, full_name, phone) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [u.email, h, u.role, u.full_name, u.phone]
  );
  return { id: i.rows[0].id, created: true };
}

async function ensureProject(c, name, desc, ownerId, deptId) {
  const r = await c.query(
    'SELECT id FROM projects WHERE name=$1 AND deleted_at IS NULL',
    [name]
  );
  if (r.rowCount > 0) return r.rows[0].id;
  const i = await c.query(
    `INSERT INTO projects (name, description, status, health, priority, owner_id, department_id, start_date, due_date, progress)
     VALUES ($1,$2,'ACTIVE','ON_TRACK','HIGH',$3,$4,CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days', 25) RETURNING id`,
    [name, desc, ownerId, deptId]
  );
  return i.rows[0].id;
}

async function ensureTask(c, projectId, title, assigneeId, createdBy, status) {
  const r = await c.query(
    'SELECT id FROM project_tasks WHERE project_id=$1 AND title=$2 AND deleted_at IS NULL',
    [projectId, title]
  );
  if (r.rowCount > 0) return r.rows[0].id;
  const i = await c.query(
    `INSERT INTO project_tasks (project_id, title, description, status, priority, assignee_id, created_by, position)
     VALUES ($1,$2,$3,$4,'MEDIUM',$5,$6,0) RETURNING id`,
    [projectId, title, `Task: ${title}`, status, assigneeId, createdBy]
  );
  return i.rows[0].id;
}

async function ensureMeeting(c, title, createdBy) {
  const r = await c.query(
    'SELECT id FROM meetings WHERE title=$1 AND deleted_at IS NULL',
    [title]
  );
  if (r.rowCount > 0) return r.rows[0].id;
  const i = await c.query(
    `INSERT INTO meetings (title, description, meeting_date, start_time, end_time, created_by)
     VALUES ($1, $2, CURRENT_DATE + INTERVAL '7 days', '15:00', '16:00', $3) RETURNING id`,
    [title, 'Weekly sync', createdBy]
  );
  return i.rows[0].id;
}

async function ensureAttendance(c, userId, markedBy, status) {
  const r = await c.query(
    'SELECT id FROM attendance WHERE user_id=$1 AND date=CURRENT_DATE',
    [userId]
  );
  if (r.rowCount > 0) return r.rows[0].id;
  const i = await c.query(
    'INSERT INTO attendance (user_id, marked_by, date, status) VALUES ($1,$2,CURRENT_DATE,$3) RETURNING id',
    [userId, markedBy, status]
  );
  return i.rows[0].id;
}

async function ensureRating(c, ratedId, ratedBy, score, remarks) {
  const check = await c.query(
    'SELECT id FROM ratings WHERE rated_user_id=$1 AND rated_by=$2',
    [ratedId, ratedBy]
  );
  if (check.rowCount > 0) return check.rows[0].id;
  const i = await c.query(
    'INSERT INTO ratings (rated_user_id, rated_by, score, remarks) VALUES ($1,$2,$3,$4) RETURNING id',
    [ratedId, ratedBy, score, remarks]
  );
  return i.rows[0].id;
}

async function ensureNotification(c, userId, message) {
  const r = await c.query(
    "SELECT id FROM notifications WHERE user_id=$1 AND message=$2 AND created_at > NOW() - INTERVAL '1 hour'",
    [userId, message]
  );
  if (r.rowCount > 0) return r.rows[0].id;
  const i = await c.query(
    'INSERT INTO notifications (user_id, message) VALUES ($1,$2) RETURNING id',
    [userId, message]
  );
  return i.rows[0].id;
}

async function setManager(c, userId, managerId) {
  await c.query(
    'UPDATE users SET manager_id=$1, updated_at=NOW() WHERE id=$2',
    [managerId, userId]
  );
}

async function setDepartment(c, userId, deptId) {
  await c.query(
    'UPDATE users SET department_id=$1, updated_at=NOW() WHERE id=$2',
    [deptId, userId]
  );
}

async function main() {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    console.log('══════════════════════════════════════════');
    console.log('  Quintern · Comprehensive seed');
    console.log('══════════════════════════════════════════');
    console.log(`  Password for all users: ${SEED_PASSWORD}\n`);

    console.log('→ Departments');
    const deptIds = {};
    for (const d of DEPARTMENTS) {
      deptIds[d.name] = await ensureDepartment(c, d.name, d.description);
      console.log(`  ✓ ${d.name} (${deptIds[d.name]})`);
    }

    console.log('\n→ Users');
    const userIds = {};
    for (const u of USERS) {
      const { id, created } = await ensureUser(c, u);
      userIds[u.email] = id;
      console.log(
        `  ${created ? '✓' : '·'} ${u.role.padEnd(10)} ${u.email.padEnd(35)} → ${id}`
      );
    }

    console.log('\n→ Hierarchy + departments');
    await setDepartment(
      c,
      userIds['priya.senior@quintern.com'],
      deptIds['Engineering']
    );
    await setDepartment(
      c,
      userIds['arjun.senior@quintern.com'],
      deptIds['Design']
    );
    await setDepartment(
      c,
      userIds['neha.tl@quintern.com'],
      deptIds['Engineering']
    );
    await setDepartment(
      c,
      userIds['rahul.tl@quintern.com'],
      deptIds['Engineering']
    );
    await setDepartment(c, userIds['kavya.tl@quintern.com'], deptIds['Design']);
    await setDepartment(
      c,
      userIds['vikram.cap@quintern.com'],
      deptIds['Engineering']
    );
    await setDepartment(c, userIds['isha.cap@quintern.com'], deptIds['Design']);
    await setDepartment(
      c,
      userIds['rohan.cap@quintern.com'],
      deptIds['Growth']
    );
    await setDepartment(
      c,
      userIds['meera.cap@quintern.com'],
      deptIds['Growth']
    );

    await setManager(
      c,
      userIds['priya.senior@quintern.com'],
      userIds['admin@quintern.com']
    );
    await setManager(
      c,
      userIds['arjun.senior@quintern.com'],
      userIds['admin@quintern.com']
    );
    await setManager(
      c,
      userIds['neha.tl@quintern.com'],
      userIds['priya.senior@quintern.com']
    );
    await setManager(
      c,
      userIds['rahul.tl@quintern.com'],
      userIds['priya.senior@quintern.com']
    );
    await setManager(
      c,
      userIds['kavya.tl@quintern.com'],
      userIds['arjun.senior@quintern.com']
    );
    await setManager(
      c,
      userIds['vikram.cap@quintern.com'],
      userIds['neha.tl@quintern.com']
    );
    await setManager(
      c,
      userIds['isha.cap@quintern.com'],
      userIds['kavya.tl@quintern.com']
    );
    await setManager(
      c,
      userIds['rohan.cap@quintern.com'],
      userIds['neha.tl@quintern.com']
    );
    await setManager(
      c,
      userIds['meera.cap@quintern.com'],
      userIds['rahul.tl@quintern.com']
    );
    await setManager(
      c,
      userIds['aarav.intern@quintern.com'],
      userIds['vikram.cap@quintern.com']
    );
    await setManager(
      c,
      userIds['ananya.intern@quintern.com'],
      userIds['vikram.cap@quintern.com']
    );
    await setManager(
      c,
      userIds['dev.intern@quintern.com'],
      userIds['isha.cap@quintern.com']
    );
    await setManager(
      c,
      userIds['isha.intern@quintern.com'],
      userIds['rohan.cap@quintern.com']
    );
    await setManager(
      c,
      userIds['karan.intern@quintern.com'],
      userIds['meera.cap@quintern.com']
    );
    await setManager(
      c,
      userIds['tanvi.intern@quintern.com'],
      userIds['meera.cap@quintern.com']
    );
    console.log('  ✓ Wired ADMIN → SENIOR_TL → TL → CAPTAIN → INTERN');

    console.log('\n→ Sample project + tasks');
    const projectId = await ensureProject(
      c,
      'Quintern Platform v2',
      'Migrate to Node 24 + React 19 + PostgreSQL 18, add AI assistant, harden security.',
      userIds['priya.senior@quintern.com'],
      deptIds['Engineering']
    );
    console.log(`  ✓ Project "Quintern Platform v2" (${projectId})`);

    const priya = userIds['priya.senior@quintern.com'];
    await ensureTask(
      c,
      projectId,
      'Set up Neon PostgreSQL 18',
      userIds['aarav.intern@quintern.com'],
      priya,
      'DONE'
    );
    await ensureTask(
      c,
      projectId,
      'Migrate from Fastify v4 to v5',
      userIds['vikram.cap@quintern.com'],
      priya,
      'IN_PROGRESS'
    );
    await ensureTask(
      c,
      projectId,
      'Build Groq AI assistant',
      userIds['neha.tl@quintern.com'],
      priya,
      'IN_PROGRESS'
    );
    await ensureTask(
      c,
      projectId,
      'Write integration tests',
      userIds['rahul.tl@quintern.com'],
      priya,
      'TODO'
    );
    await ensureTask(
      c,
      projectId,
      'Design new dashboard',
      userIds['isha.cap@quintern.com'],
      priya,
      'IN_REVIEW'
    );
    await ensureTask(
      c,
      projectId,
      'Configure Upstash Redis',
      userIds['dev.intern@quintern.com'],
      priya,
      'DONE'
    );
    console.log('  ✓ 6 tasks created');

    console.log('\n→ Sample meeting');
    const meetingId = await ensureMeeting(c, 'Engineering weekly sync', priya);
    console.log(`  ✓ Meeting (${meetingId})`);

    console.log('\n→ Sample attendance (today)');
    const interns = USERS.filter((u) => u.role === 'INTERN');
    const statuses = [
      'PRESENT',
      'PRESENT',
      'PRESENT',
      'HALF_DAY',
      'WFH',
      'PRESENT',
    ];
    for (let i = 0; i < interns.length; i++) {
      const intern = interns[i];
      const capEmail = intern.email.replace('.intern', '.cap');
      const markedBy = userIds[capEmail] || userIds['admin@quintern.com'];
      await ensureAttendance(
        c,
        userIds[intern.email],
        markedBy,
        statuses[i % statuses.length]
      );
    }
    console.log(`  ✓ ${interns.length} attendance records`);

    console.log('\n→ Sample ratings');
    await ensureRating(
      c,
      userIds['aarav.intern@quintern.com'],
      userIds['vikram.cap@quintern.com'],
      4,
      'Great progress on DB setup'
    );
    await ensureRating(
      c,
      userIds['ananya.intern@quintern.com'],
      userIds['vikram.cap@quintern.com'],
      5,
      'Excellent work'
    );
    await ensureRating(
      c,
      userIds['dev.intern@quintern.com'],
      userIds['isha.cap@quintern.com'],
      3,
      'On track'
    );
    await ensureRating(
      c,
      userIds['vikram.cap@quintern.com'],
      userIds['neha.tl@quintern.com'],
      4,
      'Good leadership'
    );
    console.log('  ✓ 4 ratings created');

    console.log('\n→ Sample notifications');
    for (const u of USERS) {
      await ensureNotification(
        c,
        userIds[u.email],
        `Welcome to Quintern, ${u.full_name}!`
      );
    }
    console.log(`  ✓ ${USERS.length} welcome notifications`);

    await c.query('COMMIT');
    console.log('\n══════════════════════════════════════════');
    console.log('  ✓ Seed complete');
    console.log(`  Total users:    ${USERS.length}`);
    console.log(`  Total depts:    ${DEPARTMENTS.length}`);
    console.log(`  Password:       ${SEED_PASSWORD}`);
    console.log('══════════════════════════════════════════');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('Seed failed:', e);
    process.exit(1);
  } finally {
    c.release();
    await pool.end();
  }
}

main();
