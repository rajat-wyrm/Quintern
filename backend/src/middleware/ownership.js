const { checkHierarchyAccess } = require('../utils/hierarchy');
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ownership(paramName = 'id') {
  // Returns an async preHandler with only 2 args (no done)
  return async (request, reply) => {
    const target = request.params[paramName] || request.body?.user_id;
    if (!target) return reply.status(400).send({ error: 'Missing target' });
    if (typeof target === 'string' && !UUID_RE.test(target)) {
      return reply.status(400).send({ error: 'Invalid UUID' });
    }
    if (request.user.role === 'ADMIN') return; // admin bypass
    const ok = await checkHierarchyAccess(req.user.id, user_id);
    if (!ok) return reply.status(403).send({ error: 'Not in your hierarchy' });
  };
}
module.exports = ownership;
