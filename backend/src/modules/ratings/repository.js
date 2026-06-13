const pool = require('../../config/db');

async function addRating(rated, by, score, remarks, category = 'PERFORMANCE') {
  const res = await pool.query(
    `INSERT INTO ratings (rated_user_id, rated_by, score, remarks, category)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [rated, by, score, remarks, category]
  );
  return res.rows[0];
}

async function getRatings(userId) {
  const res = await pool.query(
    `SELECT * FROM ratings
     WHERE rated_user_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );
  return res.rows;
}

async function getAverageRating(userId) {
  // Returns { avg, count } rounded to 2dp. Used by the team-members list.
  const res = await pool.query(
    `SELECT AVG(score)::float AS avg, COUNT(*)::int AS count
     FROM ratings WHERE rated_user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  return { avg: res.rows[0]?.avg ? Number(Number(res.rows[0].avg).toFixed(2)) : null, count: res.rows[0]?.count || 0 };
}

module.exports = { addRating, getRatings, getAverageRating };
