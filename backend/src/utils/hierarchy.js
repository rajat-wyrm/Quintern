const pool = require('../config/db');

const MAX_CHAIN_DEPTH = { ADMIN: 99, SENIOR_TL: 4, TL: 3, CAPTAIN: 2 };

async function checkHierarchyAccess(requesterId, targetUserId, requesterRole) {
  if (requesterId === targetUserId) return true;
  const depthLimit = requesterRole ? MAX_CHAIN_DEPTH[requesterRole] : 99;
  const cap = (depthLimit ?? 99) + 1;
  const query = `WITH RECURSIVE chain AS (
    SELECT id, manager_id, 1 AS depth FROM users WHERE id = $1 AND deleted_at IS NULL
    UNION ALL
    SELECT u.id, u.manager_id, c.depth + 1
    FROM users u INNER JOIN chain c ON u.id = c.manager_id
    WHERE u.deleted_at IS NULL AND c.depth < $3
  ) SELECT depth FROM chain WHERE id = $2 LIMIT 1`;
  const res = await pool.query(query, [targetUserId, requesterId, cap]);
  const depth = res.rows[0]?.depth ?? 0;
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
