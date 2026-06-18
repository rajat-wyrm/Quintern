const supertest = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const { cacheKey } = require('../../src/modules/ai/service');

let csrfToken, accessToken, meetingId;

beforeAll(async () => {
  await app.ready();
  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/auth/csrf-token',
  });
  csrfToken = JSON.parse(csrfRes.body).csrfToken;
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
    payload: { email: 'admin@quintern.com', password: 'Quintern@2026' },
  });
  accessToken = JSON.parse(loginRes.body).accessToken;
});

afterAll(async () => {
  await app.close();
});

function authHeaders() {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
  };
}

describe('Meetings PATCH hardening (issue #4)', () => {
  let mId;
  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/meetings',
      headers: authHeaders(),
      payload: {
        title: 'PATCH hardening test',
        meetingDate: '2026-12-15',
      },
    });
    mId = JSON.parse(res.body).id;
  });

  it('rejects non-uuid meeting id gracefully (404)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/meetings/00000000-0000-0000-0000-000000000000',
      headers: authHeaders(),
      payload: { title: 'nope' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects unknown fields (strict zod)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/meetings/${mId}`,
      headers: authHeaders(),
      payload: { title: 'ok', bogus_field: 'injection' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects bad meeting_date format with 400 not 500', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/meetings/${mId}`,
      headers: authHeaders(),
      payload: { meeting_date: 'tomorrow at 3pm' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.details).toBeDefined();
  });

  it('rejects bad start_time format with 400 not 500', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/meetings/${mId}`,
      headers: authHeaders(),
      payload: { start_time: 'three pm' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty body with 400', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/meetings/${mId}`,
      headers: authHeaders(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts valid snake_case update and writes audit log', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/meetings/${mId}`,
      headers: authHeaders(),
      payload: {
        title: 'Patched via hardening test',
        start_time: '14:30',
        end_time: '15:30',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.title).toBe('Patched via hardening test');

    const audit = await pool.query(
      `SELECT action, details FROM audit_logs
       WHERE resource_type = 'meeting' AND resource_id = $1
       AND action = 'MEETING_UPDATED'
       ORDER BY created_at DESC LIMIT 1`,
      [mId]
    );
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0].details.title).toBe('Patched via hardening test');
    expect(audit.rows[0].details.start_time).toBe('14:30');
  });
});

describe('Meetings POST time format validation', () => {
  it('rejects malformed startTime with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/meetings',
      headers: authHeaders(),
      payload: {
        title: 'Bad time meeting',
        meetingDate: '2026-12-20',
        startTime: 'three pm',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects unknown fields (strict zod)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/meetings',
      headers: authHeaders(),
      payload: {
        title: 'Strict test',
        meetingDate: '2026-12-20',
        evil_field: 'x',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('AI cache key includes history (issue #2)', () => {
  it('produces different keys for the same last message with different history', () => {
    const sys = 'sys';
    const a = cacheKey('groq', sys, [
      { role: 'user', content: 'earlier context A' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'summarize' },
    ]);
    const b = cacheKey('groq', sys, [
      { role: 'user', content: 'earlier context B' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'summarize' },
    ]);
    expect(a).not.toBe(b);
  });

  it('produces the same key for the same full conversation', () => {
    const sys = 'sys';
    const msgs = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];
    expect(cacheKey('groq', sys, msgs)).toBe(cacheKey('groq', sys, msgs));
  });

  it('different system prompts yield different keys', () => {
    const msgs = [{ role: 'user', content: 'hi' }];
    expect(cacheKey('groq', 'A', msgs)).not.toBe(cacheKey('groq', 'B', msgs));
  });

  it('different providers yield different keys', () => {
    const msgs = [{ role: 'user', content: 'hi' }];
    expect(cacheKey('groq', 's', msgs)).not.toBe(cacheKey('gemini', 's', msgs));
  });
});

describe('Attendance bulk audit log records all dates', () => {
  it('records the full date set when bulk spans multiple dates', async () => {
    // Find a report (any user other than admin) to mark against
    const { rows } = await pool.query(
      `SELECT id FROM users WHERE role IN ('INTERN','CAPTAIN') AND deleted_at IS NULL LIMIT 1`
    );
    expect(rows.length).toBe(1);
    const userId = rows[0].id;

    const res = await app.inject({
      method: 'POST',
      url: '/api/attendance/bulk',
      headers: authHeaders(),
      payload: {
        entries: [
          { user_id: userId, date: '2026-06-10', status: 'PRESENT' },
          { user_id: userId, date: '2026-06-11', status: 'PRESENT' },
          { user_id: userId, date: '2026-06-12', status: 'WFH' },
        ],
      },
    });
    expect(res.statusCode).toBe(200);

    const audit = await pool.query(
      `SELECT details FROM audit_logs
       WHERE action = 'ATTENDANCE_BULK_MARKED'
       ORDER BY created_at DESC LIMIT 1`
    );
    expect(audit.rowCount).toBe(1);
    const details = audit.rows[0].details;
    expect(details.count).toBe(3);
    expect(details.dates).toEqual(['2026-06-10', '2026-06-11', '2026-06-12']);
    expect(details.date_range).toEqual({
      from: '2026-06-10',
      to: '2026-06-12',
    });
  });
});
