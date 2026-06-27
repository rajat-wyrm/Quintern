// Enforce the SRS 6 / 12.2 hierarchy:
//   Captain    -> Intern                        (chain depth 2)
//   TL         -> Captain, Intern               (chain depth 3)
//   Senior TL  -> TL, Captain, Intern           (chain depth 4)
//   Admin      -> anyone
//
// The middleware reads `target` from body[`<field>`] (or params[`<field>`])
// and rejects the request unless the requester is in the target's upward
// chain. Self-management is always rejected.
//
// "Chain depth" is 1-based from the target walking up: target itself is
// depth 1, its direct manager is depth 2, etc. So Senior_TL→Intern walks
// Intern→Captain→TL→Senior_TL = depth 4.
const { isValidStep } = require('../utils/hierarchy');

// Maximum chain depth (target inclusive) the requester is allowed to reach.
const MAX_CHAIN_DEPTH = { ADMIN: 99, SENIOR_TL: 4, TL: 3, CAPTAIN: 2 };

function isInSubtree(requesterRole, requesterId, targetId, pool) {
  // Walk the management tree upward from `targetId`, looking for
  // `requesterId`. Returns the chain depth (1 = target itself, 2 = direct
  // manager, 3 = grand-manager, etc.) or 0 if the requester is not in
  // the target's chain.
  // Capped at MAX_CHAIN_DEPTH[requesterRole] + 1 so we don't pull more
  // rows than we'll ever check.
  return new Promise(async (resolve, reject) => {
    try {
      const cap = (MAX_CHAIN_DEPTH[requesterRole] ?? 0) + 1;
      const { rows } = await pool.query(
        `WITH RECURSIVE chain AS (
           SELECT id, manager_id, 1 AS depth
           FROM users WHERE id = $1 AND deleted_at IS NULL
           UNION ALL
           SELECT u.id, u.manager_id, c.depth + 1
           FROM users u INNER JOIN chain c ON u.id = c.manager_id
           WHERE u.deleted_at IS NULL AND c.depth < $3
         )
         SELECT depth FROM chain WHERE id = $2 LIMIT 1`,
        [targetId, requesterId, cap]
      );
      resolve(rows[0]?.depth ?? 0);
    } catch (e) {
      reject(e);
    }
  });
}

function directManagerValidation(field = 'user_id') {
  return async (request, reply) => {
    const target =
      request.body?.[field] ||
      request.params?.[field] ||
      request.query?.[field];
    if (!target) return reply.status(400).send({ error: 'Target required' });
    if (target === request.user.id) {
      return reply.status(400).send({ error: 'You cannot rate yourself' });
    }
    const pool = require('../config/db');
    const {
      rows: [user],
    } = await pool.query('SELECT id, role FROM users WHERE id = $1', [target]);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    if (request.user.role === 'ADMIN') return; // admin bypass

    const depth = await isInSubtree(
      request.user.role,
      request.user.id,
      target,
      pool
    );
    if (!depth)
      return reply
        .status(403)
        .send({ error: 'This member is not in your team' });

    // `depth` is 1-based from the target walking up to the requester, so the
    // requester being the direct manager is depth 2. Cap at MAX_CHAIN_DEPTH.
    const maxDepth = MAX_CHAIN_DEPTH[request.user.role] ?? 0;
    if (depth > maxDepth) {
      return reply.status(403).send({
        error: 'Not your direct report or invalid step',
        detail: `A ${request.user.role} can manage members up to ${maxDepth > 0 ? maxDepth - 1 : 0} level(s) below in the hierarchy.`,
      });
    }
  };
}

module.exports = directManagerValidation;
