require('dotenv').config();
const pool = require('../src/config/db');
const argon2 = require('argon2');

const DEMO_PASSWORD = 'Password@123';

const DEPARTMENTS = [
  { name: 'Engineering' },
  { name: 'Marketing' },
  { name: 'Design' },
];

const USERS = [
  {
    email: 'aanya.s@internops.com',
    full_name: 'Aanya Sharma',
    role: 'SENIOR_TL',
    department: 'Engineering',
    phone: '+91 98101 11111',
    location: 'Bengaluru',
    notes: 'Owns the Engineering org line.',
  },
  {
    email: 'rohan.v@internops.com',
    full_name: 'Rohan Verma',
    role: 'TL',
    department: 'Engineering',
    manager_email: 'aanya.s@internops.com',
    phone: '+91 98101 22222',
    location: 'Bengaluru',
  },
  {
    email: 'priya.i@internops.com',
    full_name: 'Priya Iyer',
    role: 'CAPTAIN',
    department: 'Engineering',
    manager_email: 'rohan.v@internops.com',
    phone: '+91 98101 33333',
    location: 'Pune',
  },
  {
    email: 'karan.s@internops.com',
    full_name: 'Karan Singh',
    role: 'CAPTAIN',
    department: 'Engineering',
    manager_email: 'rohan.v@internops.com',
    phone: '+91 98101 33344',
    location: 'Delhi',
  },
  {
    email: 'neha.k@internops.com',
    full_name: 'Neha Kapoor',
    role: 'TL',
    department: 'Marketing',
    manager_email: 'aanya.s@internops.com',
    phone: '+91 98101 44444',
    location: 'Mumbai',
  },
  {
    email: 'vikram.m@internops.com',
    full_name: 'Vikram Mehta',
    role: 'SENIOR_TL',
    department: 'Design',
    phone: '+91 98101 55555',
    location: 'Hyderabad',
  },
  {
    email: 'isha.r@internops.com',
    full_name: 'Isha Roy',
    role: 'CAPTAIN',
    department: 'Design',
    manager_email: 'vikram.m@internops.com',
    phone: '+91 98101 66666',
    location: 'Bengaluru',
  },

  {
    email: 'arjun.n@internops.com',
    full_name: 'Arjun Nair',
    role: 'INTERN',
    department: 'Engineering',
    manager_email: 'priya.i@internops.com',
    college: 'IIT Bombay',
    course: 'B.Tech CSE',
    year_of_study: '3rd Year',
    position: 'Backend Intern',
    location: 'Bengaluru',
    joining_date: '2026-01-15',
  },
  {
    email: 'meera.p@internops.com',
    full_name: 'Meera Pillai',
    role: 'INTERN',
    department: 'Engineering',
    manager_email: 'priya.i@internops.com',
    college: 'NIT Trichy',
    course: 'B.Tech IT',
    year_of_study: '4th Year',
    position: 'Frontend Intern',
    location: 'Chennai',
    joining_date: '2026-02-01',
  },
  {
    email: 'dev.d@internops.com',
    full_name: 'Dev Das',
    role: 'INTERN',
    department: 'Engineering',
    manager_email: 'karan.s@internops.com',
    college: 'BITS Pilani',
    course: 'M.Sc. Data Science',
    year_of_study: '1st Year',
    position: 'ML Intern',
    location: 'Remote',
    joining_date: '2026-01-20',
  },
  {
    email: 'sara.k@internops.com',
    full_name: 'Sara Khan',
    role: 'INTERN',
    department: 'Engineering',
    manager_email: 'karan.s@internops.com',
    college: 'VIT Vellore',
    course: 'B.Tech CSE',
    year_of_study: '3rd Year',
    position: 'DevOps Intern',
    location: 'Remote',
    joining_date: '2026-02-10',
  },
  {
    email: 'rahul.g@internops.com',
    full_name: 'Rahul Gupta',
    role: 'INTERN',
    department: 'Marketing',
    manager_email: 'neha.k@internops.com',
    college: 'Christ University',
    course: 'BBA',
    year_of_study: '2nd Year',
    position: 'Growth Intern',
    location: 'Delhi',
    joining_date: '2026-01-25',
  },
  {
    email: 'tanya.b@internops.com',
    full_name: 'Tanya Bhatt',
    role: 'INTERN',
    department: 'Marketing',
    manager_email: 'neha.k@internops.com',
    college: 'Symbiosis',
    course: 'BBA Marketing',
    year_of_study: '3rd Year',
    position: 'Content Intern',
    location: 'Pune',
    joining_date: '2026-02-05',
  },
  {
    email: 'kabir.j@internops.com',
    full_name: 'Kabir Joshi',
    role: 'INTERN',
    department: 'Design',
    manager_email: 'isha.r@internops.com',
    college: 'NID Ahmedabad',
    course: 'B.Des',
    year_of_study: '4th Year',
    position: 'Product Design Intern',
    location: 'Ahmedabad',
    joining_date: '2026-01-10',
  },
  {
    email: 'aisha.m@internops.com',
    full_name: 'Aisha Mohammed',
    role: 'INTERN',
    department: 'Design',
    manager_email: 'isha.r@internops.com',
    college: 'Srishti Manipal',
    course: 'B.Des Visual Comm.',
    year_of_study: '3rd Year',
    position: 'Brand Design Intern',
    location: 'Bengaluru',
    joining_date: '2026-02-12',
  },
];

const TASKS = [
  {
    title: 'Share Quintern launch post on LinkedIn',
    description:
      'Post a thoughtful commentary with the launch link on your LinkedIn profile. Tag the company page.',
    target_platform: 'LinkedIn',
    task_link: 'https://www.linkedin.com/company/internops',
    daysFromNow: 4,
  },
  {
    title: 'Star the Quintern GitHub repo + follow',
    description:
      'Star the public Quintern repository on GitHub and submit a screenshot of the notifications tab.',
    target_platform: 'GitHub',
    task_link: 'https://github.com/rajat-wyrm/Quintern',
    daysFromNow: 3,
  },
  {
    title: 'Tweet about your week-1 learnings',
    description:
      'Share a 280-character tweet on X/Twitter with the #Quintern hashtag.',
    target_platform: 'Twitter',
    task_link: '',
    daysFromNow: 2,
  },
  {
    title: 'Publish a blog: My First Sprint at Quintern',
    description:
      'Write a 600+ word Medium article about your first sprint, embed at least one screenshot.',
    target_platform: 'Medium',
    task_link: '',
    daysFromNow: 9,
  },
  {
    title: 'Instagram Reel: A day in the Quintern life',
    description:
      '30-second reel showing your workspace and stack. Use the official audio.',
    target_platform: 'Instagram',
    task_link: '',
    daysFromNow: 12,
  },
];

const MEETINGS = [
  {
    title: 'Engineering Weekly Sync',
    description: 'Standup-style: wins, blockers, demo.',
    daysFromNow: 1,
    hour: 10,
    attendees_role: 'ENGINEERING',
    department: 'Engineering',
  },
  {
    title: 'Marketing Retro',
    description: "Review last month's campaign metrics.",
    daysFromNow: 3,
    hour: 15,
    attendees_role: 'MARKETING',
    department: 'Marketing',
  },
  {
    title: 'All-hands Townhall',
    description: 'Org update + Q&A with leadership.',
    daysFromNow: 7,
    hour: 17,
    attendees_role: 'ALL',
    department: null,
  },
  {
    title: 'Design Critique',
    description: 'Walk-through of the new dashboard screens.',
    daysFromNow: 2,
    hour: 11,
    attendees_role: 'DESIGN',
    department: 'Design',
  },
  {
    title: 'Intern Onboarding Replay (past)',
    description: 'Catch-up session for the latest batch.',
    daysFromNow: -5,
    hour: 14,
    attendees_role: 'INTERNS',
    department: null,
  },
];

const NOTIFICATION_TEMPLATES = {
  ATTENDANCE_MARKED: (by) => `Your attendance was marked PRESENT by ${by}.`,
  RATING_RECEIVED: (by, score) =>
    `You received a new rating (${score}/5) from ${by}.`,
  TASK_ASSIGNED: (title) => `A new social task was assigned: ${title}.`,
  TASK_VERIFIED: (by) => `Your task submission was verified by ${by}.`,
  MEETING_INVITED: (title) => `You were invited to: ${title}.`,
};

function isoDate(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function isoDateTime(offsetDays, hour) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function cleanDemo(client) {
  // Keep the seeded admin; wipe everything else for a clean visual-test state.
  await client.query(
    `DELETE FROM meeting_attendees WHERE meeting_id IN (SELECT id FROM meetings WHERE created_by <> (SELECT id FROM users WHERE email='admin@internops.com' AND deleted_at IS NULL) OR created_by IS NULL)`
  );
  await client.query(
    `DELETE FROM meetings WHERE created_by <> (SELECT id FROM users WHERE email='admin@internops.com' AND deleted_at IS NULL) OR created_by IS NULL`
  );

  await client.query(
    `DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email <> 'admin@internops.com' AND deleted_at IS NULL)`
  );

  await client.query(
    `DELETE FROM proof_submissions WHERE intern_id IN (SELECT id FROM users WHERE email <> 'admin@internops.com' AND deleted_at IS NULL)`
  );
  await client.query(
    `DELETE FROM social_tasks WHERE created_by IN (SELECT id FROM users WHERE email <> 'admin@internops.com' AND deleted_at IS NULL)`
  );

  await client.query(
    `DELETE FROM ratings WHERE rated_user_id IN (SELECT id FROM users WHERE email <> 'admin@internops.com' AND deleted_at IS NULL) OR rated_by IN (SELECT id FROM users WHERE email <> 'admin@internops.com' AND deleted_at IS NULL)`
  );
  await client.query(
    `DELETE FROM attendance WHERE user_id IN (SELECT id FROM users WHERE email <> 'admin@internops.com' AND deleted_at IS NULL)`
  );

  await client.query(
    `DELETE FROM users WHERE email <> 'admin@internops.com' AND deleted_at IS NULL`
  );
  await client.query(
    `DELETE FROM departments WHERE name NOT IN (SELECT DISTINCT name FROM departments WHERE name = ANY($1::text[]))`,
    [DEPARTMENTS.map((d) => d.name)]
  );
}

async function upsertDepartments(client) {
  const map = new Map();
  for (const d of DEPARTMENTS) {
    const r = await client.query(
      `INSERT INTO departments (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [d.name]
    );
    map.set(d.name, r.rows[0].id);
  }
  return map;
}

async function upsertUsers(client, deptMap) {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const userMap = new Map();
  // Two passes: first insert users with no manager, then update manager_id.
  for (const u of USERS) {
    const deptId = deptMap.get(u.department);
    const r = await client.query(
      `INSERT INTO users (
         email, password_hash, role, full_name, department_id,
         phone, college, course, year_of_study, position, location,
         joining_date, internship_status, email_verified, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ACTIVE',TRUE,$13)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         department_id = EXCLUDED.department_id,
         phone = EXCLUDED.phone,
         college = EXCLUDED.college,
         course = EXCLUDED.course,
         year_of_study = EXCLUDED.year_of_study,
         position = EXCLUDED.position,
         location = EXCLUDED.location,
         joining_date = EXCLUDED.joining_date,
         internship_status = 'ACTIVE',
         email_verified = TRUE,
         notes = EXCLUDED.notes,
         deleted_at = NULL
       RETURNING id, email`,
      [
        u.email,
        passwordHash,
        u.role,
        u.full_name,
        deptId,
        u.phone || null,
        u.college || null,
        u.course || null,
        u.year_of_study || null,
        u.position || null,
        u.location || null,
        u.joining_date || null,
        u.notes || null,
      ]
    );
    userMap.set(u.email, r.rows[0].id);
  }
  // Wire up manager_id
  for (const u of USERS) {
    if (!u.manager_email) continue;
    const mgrId = userMap.get(u.manager_email);
    if (!mgrId) continue;
    await client.query(`UPDATE users SET manager_id = $1 WHERE id = $2`, [
      mgrId,
      userMap.get(u.email),
    ]);
  }
  return userMap;
}

async function seedAttendance(client, userMap) {
  const interns = USERS.filter((u) => u.role === 'INTERN');
  for (const intern of interns) {
    const internId = userMap.get(intern.email);
    const captainId = userMap.get(intern.manager_email);
    for (let i = 30; i >= 1; i--) {
      // Skip weekends
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) continue;

      // 80% PRESENT, 12% ABSENT, 8% HALF_DAY
      const r = Math.random();
      const status = r < 0.8 ? 'PRESENT' : r < 0.92 ? 'ABSENT' : 'HALF_DAY';
      const remarks =
        status === 'ABSENT'
          ? 'No-show, no leave intimation'
          : status === 'HALF_DAY'
            ? 'Left early — personal commitment'
            : Math.random() < 0.2
              ? 'On-time, productive day'
              : null;

      await client.query(
        `INSERT INTO attendance (user_id, marked_by, date, status, remarks)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, date) DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks`,
        [internId, captainId, d.toISOString().slice(0, 10), status, remarks]
      );
    }
  }
}

async function seedRatings(client, userMap) {
  const interns = USERS.filter((u) => u.role === 'INTERN');
  const remarksPool = [
    'Consistently delivers above expectations.',
    'Strong technical communication in standups.',
    'Great collaboration with the design team.',
    'Took ownership of a tricky bug end-to-end.',
    'Could improve on time management for daily tasks.',
    'Excellent code reviews — catches edge cases.',
    'Needs to be more proactive in asking questions.',
  ];
  for (const intern of interns) {
    const internId = userMap.get(intern.email);
    const mgrId = userMap.get(intern.manager_email);
    const count = 2 + Math.floor(Math.random() * 2); // 2-3 ratings
    for (let i = 0; i < count; i++) {
      const score = 3 + Math.floor(Math.random() * 3); // 3..5
      const remarks =
        remarksPool[Math.floor(Math.random() * remarksPool.length)];
      const d = new Date();
      d.setUTCDate(
        d.getUTCDate() - (5 + i * 14 + Math.floor(Math.random() * 5))
      );
      await client.query(
        `INSERT INTO ratings (rated_user_id, rated_by, score, remarks, created_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [internId, mgrId, score, remarks, d.toISOString()]
      );
    }
  }
}

async function seedTasksAndProofs(client, userMap) {
  const seniorsAndTls = USERS.filter((u) =>
    ['SENIOR_TL', 'ADMIN'].includes(u.role)
  );
  const captains = USERS.filter((u) => u.role === 'CAPTAIN');
  const interns = USERS.filter((u) => u.role === 'INTERN');
  const taskIdMap = new Map();

  for (const t of TASKS) {
    const creatorEmail =
      seniorsAndTls[Math.floor(Math.random() * seniorsAndTls.length)].email;
    const creatorId = userMap.get(creatorEmail);
    const r = await client.query(
      `INSERT INTO social_tasks (title, description, target_platform, task_link, deadline, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        t.title,
        t.description,
        t.target_platform,
        t.task_link || null,
        isoDateTime(t.daysFromNow, 23),
        creatorId,
      ]
    );
    taskIdMap.set(t.title, r.rows[0].id);
  }

  // Each intern gets proofs for the first 2-3 tasks
  for (const intern of interns) {
    const internId = userMap.get(intern.email);
    const captainId = userMap.get(intern.manager_email);
    const shuffledTasks = [...TASKS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    for (const t of shuffledTasks) {
      const taskId = taskIdMap.get(t.title);
      const statusRoll = Math.random();
      const status =
        statusRoll < 0.4
          ? 'PENDING'
          : statusRoll < 0.75
            ? 'VERIFIED'
            : 'REJECTED';
      const imagePath = `/uploads/proofs/demo_${intern.email.split('@')[0]}_${t.target_platform.toLowerCase()}.png`;
      const verifiedBy = status === 'PENDING' ? null : captainId;
      const verifiedAt = status === 'PENDING' ? null : new Date().toISOString();
      await client.query(
        `INSERT INTO proof_submissions (task_id, intern_id, image_path, verified_by, verified_at, status)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [taskId, internId, imagePath, verifiedBy, verifiedAt, status]
      );
    }
  }
}

async function seedMeetings(client, userMap) {
  const seniors = USERS.filter((u) => ['SENIOR_TL', 'ADMIN'].includes(u.role));
  const deptMap = (
    await client.query(`SELECT id, name FROM departments`)
  ).rows.reduce((acc, r) => ((acc[r.name] = r.id), acc), {});

  for (const m of MEETINGS) {
    const creatorEmail =
      seniors[Math.floor(Math.random() * seniors.length)].email;
    const creatorId = userMap.get(creatorEmail);
    const deptId = m.department ? deptMap[m.department] : null;
    const r = await client.query(
      `INSERT INTO meetings (title, description, meeting_date, start_time, end_time, created_by, department_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        m.title,
        m.description,
        isoDate(m.daysFromNow),
        `${String(m.hour).padStart(2, '0')}:00:00`,
        `${String(m.hour + 1).padStart(2, '0')}:00:00`,
        creatorId,
        deptId,
      ]
    );
    const meetingId = r.rows[0].id;

    // Pick attendees by rule
    let attendees = [];
    if (m.attendees_role === 'ALL') {
      attendees = USERS.map((u) => u.email);
    } else if (m.attendees_role === 'INTERNS') {
      attendees = USERS.filter((u) => u.role === 'INTERN').map((u) => u.email);
    } else if (m.department) {
      attendees = USERS.filter((u) => u.department === m.department).map(
        (u) => u.email
      );
    }
    for (const email of attendees) {
      const uid = userMap.get(email);
      if (!uid) continue;
      await client.query(
        `INSERT INTO meeting_attendees (meeting_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [meetingId, uid]
      );
    }
  }
}

async function seedNotifications(client, userMap) {
  for (const u of USERS) {
    const userId = userMap.get(u.email);
    const manager = USERS.find((m) => m.email === u.manager_email);
    const managerName = manager ? manager.full_name : 'Admin';

    // Attendance notification (last 2 days)
    await client.query(
      `INSERT INTO notifications (user_id, message, read, created_at) VALUES ($1,$2,FALSE,$3)`,
      [
        userId,
        NOTIFICATION_TEMPLATES.ATTENDANCE_MARKED(managerName),
        new Date(Date.now() - 1 * 86400000).toISOString(),
      ]
    );
    // Rating notification
    if (u.role === 'INTERN') {
      await client.query(
        `INSERT INTO notifications (user_id, message, read, created_at) VALUES ($1,$2,$3,$4)`,
        [
          userId,
          NOTIFICATION_TEMPLATES.RATING_RECEIVED(managerName, 4),
          Math.random() < 0.4,
          new Date(Date.now() - 3 * 86400000).toISOString(),
        ]
      );
    }
    // Meeting invited
    await client.query(
      `INSERT INTO notifications (user_id, message, read, created_at) VALUES ($1,$2,$3,$4)`,
      [
        userId,
        NOTIFICATION_TEMPLATES.MEETING_INVITED('Engineering Weekly Sync'),
        Math.random() < 0.6,
        new Date(Date.now() - 2 * 86400000).toISOString(),
      ]
    );
    // Task assigned
    await client.query(
      `INSERT INTO notifications (user_id, message, read, created_at) VALUES ($1,$2,$3,$4)`,
      [
        userId,
        NOTIFICATION_TEMPLATES.TASK_ASSIGNED(
          'Share Quintern launch post on LinkedIn'
        ),
        Math.random() < 0.5,
        new Date(Date.now() - 4 * 86400000).toISOString(),
      ]
    );
    // Generic system note
    await client.query(
      `INSERT INTO notifications (user_id, message, read, created_at) VALUES ($1,$2,$3,$4)`,
      [
        userId,
        'Welcome to Quintern! Update your profile to get started.',
        true,
        new Date(Date.now() - 14 * 86400000).toISOString(),
      ]
    );
  }
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('• Cleaning prior demo data (admin preserved)...');
    await cleanDemo(client);

    console.log('• Upserting departments...');
    const deptMap = await upsertDepartments(client);

    console.log('• Upserting users (one of each role + 8 interns)...');
    const userMap = await upsertUsers(client, deptMap);

    console.log('• Seeding 30 days of attendance per intern...');
    await seedAttendance(client, userMap);

    console.log('• Seeding ratings...');
    await seedRatings(client, userMap);

    console.log('• Seeding social tasks + proof submissions...');
    await seedTasksAndProofs(client, userMap);

    console.log('• Seeding meetings + attendees...');
    await seedMeetings(client, userMap);

    console.log('• Seeding notifications...');
    await seedNotifications(client, userMap);

    await client.query('COMMIT');
    console.log('\n✅ Demo data ready.\n');

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS users,
        (SELECT COUNT(*) FROM departments) AS departments,
        (SELECT COUNT(*) FROM attendance) AS attendance,
        (SELECT COUNT(*) FROM ratings) AS ratings,
        (SELECT COUNT(*) FROM social_tasks) AS tasks,
        (SELECT COUNT(*) FROM proof_submissions) AS proofs,
        (SELECT COUNT(*) FROM meetings) AS meetings,
        (SELECT COUNT(*) FROM notifications) AS notifications
    `);
    console.table(counts.rows[0]);

    console.log(
      '\nLogin credentials (password for everyone below: ' +
        DEMO_PASSWORD +
        '):\n'
    );
    console.log('  ADMIN       admin@internops.com      (also: Admin@123)');
    console.log('  SENIOR_TL   aanya.s@internops.com    (Engineering)');
    console.log('  TL          rohan.v@internops.com    (Engineering)');
    console.log('  CAPTAIN     priya.i@internops.com    (Engineering)');
    console.log('  CAPTAIN     karan.s@internops.com    (Engineering)');
    console.log('  TL          neha.k@internops.com     (Marketing)');
    console.log('  SENIOR_TL   vikram.m@internops.com   (Design)');
    console.log('  CAPTAIN     isha.r@internops.com     (Design)');
    console.log('  INTERN      arjun.n@internops.com    (under Priya)');
    console.log('  INTERN      meera.p@internops.com    (under Priya)');
    console.log('  INTERN      dev.d@internops.com      (under Karan)');
    console.log('  INTERN      sara.k@internops.com     (under Karan)');
    console.log('  INTERN      rahul.g@internops.com    (under Neha)');
    console.log('  INTERN      tanya.b@internops.com    (under Neha)');
    console.log('  INTERN      kabir.j@internops.com    (under Isha)');
    console.log('  INTERN      aisha.m@internops.com    (under Isha)\n');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Seed failed:', e.message);
    console.error(e.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
