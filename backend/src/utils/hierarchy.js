const pool = require('../config/db');
const MAX_CHAIN_DEPTH = { ADMIN: 99, SENIOR_TL: 4, TL: 3, CAPTAIN: 2 };

async function checkHierarchyAccess(requesterId, targetUserId, requesterRole) {
  if (requesterId === targetUserId) return true;
  if (requesterRole === 'ADMIN') return true;
  const cap = (MAX_CHAIN_DEPTH[requesterRole] ?? 1) + 1;
  const { rows } = await pool.query(
    `WITH RECURSIVE chain AS (
        SELECT id, manager_id, 1 AS depth FROM users WHERE id = $1
        UNION ALL
        SELECT u.id, u.manager_id, c.depth + 1
        FROM users u INNER JOIN chain c ON u.id = c.manager_id
        WHERE c.depth < $3
      ) SELECT depth FROM chain WHERE id = $2 LIMIT 1`,
    [targetUserId, requesterId, cap]
  );
  const depth = rows[0]?.depth ?? 0;
  return depth > 0 && depth <= cap - 1;
}
async function isDirectManager(managerId, subordinateId) {
  const res = await pool.query('SELECT manager_id FROM users WHERE id = $1', [
    subordinateId,
  ]);
  return res.rows[0]?.manager_id === managerId;
}
const roleStepMap = {
  ADMIN: ['SENIOR_TL'],
  SENIOR_TL: ['TL'],
  TL: ['CAPTAIN'],
  CAPTAIN: ['INTERN'],
};
function isValidStep(managerRole, subordinateRole) {
  return roleStepMap[managerRole]?.includes(subordinateRole) ?? false;
}
module.exports = { checkHierarchyAccess, isDirectManager, isValidStep };
