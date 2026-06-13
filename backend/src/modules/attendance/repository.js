const pool = require('../../config/db');

// Single-row insert/upsert. Kept for the /mark endpoint.
async function markAttendance(userId, markedBy, date, status, remarks) {
  const res = await pool.query(
    `INSERT INTO attendance (user_id, marked_by, date, status, remarks)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, date)
     DO UPDATE SET status=$4, marked_by=$2, remarks=$5, updated_at=NOW()
     RETURNING *`,
    [userId, markedBy, date, status, remarks || null]
  );
  return res.rows[0];
}

async function getAttendance(userId, from, to) {
  let q = 'SELECT * FROM attendance WHERE user_id=$1 AND deleted_at IS NULL';
  const params = [userId];
  if (from) { q += ' AND date>=$2'; params.push(from); }
  if (to) { q += ' AND date<=$'+(params.length+1); params.push(to); }
  const res = await pool.query(q, params);
  return res.rows;
}

async function getMonthlyStats(userId, month, year) {
  const res = await pool.query(
    `SELECT status, COUNT(*) as count
     FROM attendance
     WHERE user_id=$1 AND EXTRACT(MONTH FROM date)=$2 AND EXTRACT(YEAR FROM date)=$3 AND deleted_at IS NULL
     GROUP BY status`,
    [userId, month, year]
  );
  return res.rows;
}

// Bulk insert. Uses a single multi-row INSERT with ON CONFLICT to do an
// upsert, instead of N round-trips. Previously this held a DB connection
// for the duration of a loop; with 100 entries it was O(100) round-trips
// inside one transaction. Now it's two round-trips total.
async function bulkMark(entries, markedBy) {
  if (!entries?.length) return [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Build VALUES ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10),...
    const placeholders = entries.map((_, i) => {
      const base = i * 5;
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5})`;
    }).join(',');
    const params = entries.flatMap((e) => [e.user_id, markedBy, e.date, e.status, e.remarks || null]);
    const sql = `INSERT INTO attendance (user_id, marked_by, date, status, remarks)
                 VALUES ${placeholders}
                 ON CONFLICT (user_id, date)
                 DO UPDATE SET status=EXCLUDED.status,
                               marked_by=EXCLUDED.marked_by,
                               remarks=EXCLUDED.remarks,
                               updated_at=NOW()
                 RETURNING *`;
    const res = await client.query(sql, params);
    await client.query('COMMIT');
    return res.rows;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { markAttendance, getAttendance, getMonthlyStats, bulkMark };
