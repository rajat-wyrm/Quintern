'use strict';
const app = require('../../src/app');
const pool = require('../../src/config/db');

let csrfToken;
let adminToken, seniorTLToken, tlToken, captainToken, internToken;
let otherInternToken;

beforeAll(async () => {
  await app.ready();
  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/auth/csrf-token',
  });
  csrfToken = JSON.parse(csrfRes.body).csrfToken;

  const loginUser = async (email) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      payload: { email, password: 'Quintern@2026' },
    });
    return JSON.parse(res.body).accessToken;
  };

  adminToken = await loginUser('admin@quintern.com');
  seniorTLToken = await loginUser('priya.senior@quintern.com');
  tlToken = await loginUser('neha.tl@quintern.com');
  captainToken = await loginUser('vikram.cap@quintern.com');
  internToken = await loginUser('aarav.intern@quintern.com');
  otherInternToken = await loginUser('dev.intern@quintern.com');
});

afterAll(async () => {
  await app.close();
});

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    'X-CSRF-Token': csrfToken,
  };
}

describe('AI Search Scoping (Issue #11)', () => {
  it('Admin can search all users, projects, and tasks in the organization', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/ai/search?q=intern',
      headers: headers(adminToken),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.users.length).toBeGreaterThan(0);
    expect(
      body.users.some((u) => u.email === 'aarav.intern@quintern.com')
    ).toBe(true);
    expect(body.users.some((u) => u.email === 'dev.intern@quintern.com')).toBe(
      true
    );
  });

  it('Senior TL can search all users, projects, and tasks in the organization', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/ai/search?q=intern',
      headers: headers(seniorTLToken),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(
      body.users.some((u) => u.email === 'aarav.intern@quintern.com')
    ).toBe(true);
    expect(body.users.some((u) => u.email === 'dev.intern@quintern.com')).toBe(
      true
    );
  });

  it('Intern can only search themselves, and NOT users outside their hierarchy', async () => {
    // Aarav searching for 'Aarav' should return Aarav
    const selfRes = await app.inject({
      method: 'GET',
      url: '/api/ai/search?q=Aarav',
      headers: headers(internToken),
    });
    expect(selfRes.statusCode).toBe(200);
    const selfBody = JSON.parse(selfRes.body);
    expect(
      selfBody.users.some((u) => u.email === 'aarav.intern@quintern.com')
    ).toBe(true);

    // Aarav searching for 'Dev' (outside hierarchy) should NOT return Dev
    const otherRes = await app.inject({
      method: 'GET',
      url: '/api/ai/search?q=Dev',
      headers: headers(internToken),
    });
    expect(otherRes.statusCode).toBe(200);
    const otherBody = JSON.parse(otherRes.body);
    expect(
      otherBody.users.some((u) => u.email === 'dev.intern@quintern.com')
    ).toBe(false);
  });

  it('Intern can only search projects they own or are members of', async () => {
    // In seed.js, "Quintern Platform v2" is owned by priya.senior. Aarav is not in project_members.
    // Let's first search with admin Token (should find it)
    const adminRes = await app.inject({
      method: 'GET',
      url: '/api/ai/search?q=Quintern',
      headers: headers(adminToken),
    });
    expect(JSON.parse(adminRes.body).projects.length).toBeGreaterThan(0);

    // Now search with intern token (should NOT find it since they are not a member/owner)
    const internRes = await app.inject({
      method: 'GET',
      url: '/api/ai/search?q=Quintern',
      headers: headers(internToken),
    });
    expect(JSON.parse(internRes.body).projects.length).toBe(0);
    expect(JSON.parse(internRes.body).tasks.length).toBe(0);
  });

  it('Intern can search project tasks if they are added as a project member', async () => {
    // Let's retrieve the project ID for "Quintern Platform v2"
    const {
      rows: [project],
    } = await pool.query(
      "SELECT id FROM projects WHERE name = 'Quintern Platform v2' AND deleted_at IS NULL"
    );
    const {
      rows: [aarav],
    } = await pool.query(
      "SELECT id FROM users WHERE email = 'aarav.intern@quintern.com'"
    );

    // Add Aarav to project members
    await pool.query(
      "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'CONTRIBUTOR') ON CONFLICT DO NOTHING",
      [project.id, aarav.id]
    );

    // Now Aarav should be able to search the project and tasks
    const searchRes = await app.inject({
      method: 'GET',
      url: '/api/ai/search?q=Quintern',
      headers: headers(internToken),
    });
    expect(
      JSON.parse(searchRes.body).projects.some((p) => p.id === project.id)
    ).toBe(true);

    const taskRes = await app.inject({
      method: 'GET',
      url: '/api/ai/search?q=PostgreSQL',
      headers: headers(internToken),
    });
    expect(
      JSON.parse(taskRes.body).tasks.some((t) => t.title.includes('PostgreSQL'))
    ).toBe(true);

    // Cleanup: remove member mapping
    await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [project.id, aarav.id]
    );
  });
});
