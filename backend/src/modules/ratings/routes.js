const { notifyUser } = require('../../websocket');
'use strict';
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const ownership = require('../../middleware/ownership');
const directManager = require('../../middleware/directManager');
const repo = require('./repository');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const { checkHierarchyAccess } = require('../../utils/hierarchy');
const { send: sendNotification } = require('../notifications/repository');
const { z } = require('zod');

module.exports = async function ratingsRoutes(fastify) {
  // Submit a rating for someone in your team (immutable history row).
  // SRS 12.2: only direct reports, with Senior_TL allowed a 2-step reach.
  fastify.post('/', {
    schema: { tags: ['Ratings'], description: 'Submit a rating' },
    preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'), directManager('rated_user_id')],
  }, async (req, reply) => {
    const { rated_user_id, score, remarks, category } = z.object({
      rated_user_id: z.string().uuid(),
      // 1-10 scale per UptoSkills rating spec. Never 1-5.
      score: z.coerce.number().int().min(1).max(10),
      remarks: z.string().max(2000).optional(),
      category: z.enum(['PERFORMANCE', 'TASK', 'PROJECT', 'INTERN', 'TEAM', 'MENTOR', 'REVIEW']).optional().default('PERFORMANCE'),
    }).parse(req.body);

    // Defense-in-depth: also walk the full hierarchy as a backstop. The
    // directManager middleware above already validated the strict SRS step,
    // so this is just belt-and-braces.
    if (req.user.role !== 'ADMIN') {
      const ok = await checkHierarchyAccess(req.user.id, rated_user_id);
      if (!ok) return reply.status(403).send({ error: 'This member is not in your team' });
    }

    const rating = await repo.addRating(rated_user_id, req.user.id, score, remarks || null, category);
    await createAuditLog({
      userId: req.user.id,
      ...extractRequestInfo(req),
      action: 'RATING_GIVEN',
      resourceType: 'rating',
      resourceId: rating.id,
      details: { target: rated_user_id, score, category },
    });
    sendNotification(rated_user_id, `You received a new ${category.toLowerCase()} rating: ${score}/10.`)
      .catch((e) => req.log.error({ err: e.message }, 'rating notification failed'));
    notifyUser(rating.rated_user_id, 'rating-received', { rating })
      .catch(() => {});
    return rating;
  });

  // View a user's rating history (must be self or within hierarchy).
  fastify.get('/:userId', { schema: { tags: ['Ratings'], description: 'Get rating history' }, preHandler: [auth, ownership('userId')] }, async (req) => {
    return repo.getRatings(req.params.userId);
  });
};

