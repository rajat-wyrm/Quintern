const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('../social-tasks/repository');
const { createAuditLog } = require('../../utils/audit');
const { checkHierarchyAccess } = require('../../utils/hierarchy');
const path = require('path');
const fsp = require('fs/promises');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif'];

function detectImageExt(buf) {
  if (!buf || buf.length < 8) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return '.png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38)
    return '.gif';
  return null;
}

async function routes(fastify) {
  // Submit proof (intern only)
  fastify.post(
    '/submit',
    { preHandler: [auth, rbac('INTERN')] },
    async (req, reply) => {
      const { task_id } = req.body;
      if (!task_id)
        return reply.status(400).send({ error: 'task_id required' });

      const data = await req.file();
      if (!data)
        return reply.status(400).send({ error: 'Image file required' });

      if (!ALLOWED_MIMES.includes(data.mimetype)) {
        return reply
          .status(400)
          .send({ error: 'Only JPEG, PNG, GIF images are allowed' });
      }
      if (data.file.truncated) {
        return reply.status(413).send({ error: 'File size exceeds limit' });
      }

      const buffer = await data.toBuffer();
      const ext = detectImageExt(buffer);
      if (!ext) {
        return reply.status(400).send({
          error: 'File content does not match a supported image format',
        });
      }

      const filename = uuidv4() + ext;
      // Anchor under the configured uploadDir regardless of process CWD.
      const uploadDir = path.join(
        __dirname,
        '..',
        '..',
        '..',
        config.uploadDir
      );
      const uploadPath = path.join(uploadDir, filename);
      await fsp.mkdir(uploadDir, { recursive: true });
      await fsp.writeFile(uploadPath, buffer);

      const relativePath = `proofs/${filename}`;
      const proof = await repo.submitProof(task_id, req.user.id, relativePath);
      await createAuditLog({
        userId: req.user.id,
        action: 'PROOF_SUBMITTED',
        resourceType: 'proof',
        resourceId: proof.id,
      });
      return proof;
    }
  );

  // Verify proof (Captain, TL, Senior TL) with ownership over the intern
  fastify.patch(
    '/:id/verify',
    { preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL')] },
    async (req, reply) => {
      const pool = require('../../config/db');
      const {
        rows: [proof],
      } = await pool.query('SELECT * FROM proof_submissions WHERE id = $1', [
        req.params.id,
      ]);
      if (!proof) return reply.status(404).send({ error: 'Proof not found' });
      if (req.user.role !== 'ADMIN') {
        const allowed = await checkHierarchyAccess(
          req.user.id,
          proof.intern_id,
        );
        if (!allowed)
          return reply.status(403).send({ error: 'Not in your hierarchy' });
      }
      const verified = await repo.verifyProof(req.params.id, req.user.id);
      await createAuditLog({
        userId: req.user.id,
        action: 'PROOF_VERIFIED',
        resourceType: 'proof',
        resourceId: verified.id,
      });
      return verified;
    }
  );

  // IDOR fix: scope by task AND ownership. A TL can only see proofs for tasks
  // they (or someone in their hierarchy) created, or for interns in their team.
  fastify.get(
    '/task/:taskId',
    { preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')] },
    async (req, reply) => {
      const pool = require('../../config/db');
      const {
        rows: [task],
      } = await pool.query(
        'SELECT created_by FROM social_tasks WHERE id = $1 AND deleted_at IS NULL',
        [req.params.taskId]
      );
      if (!task) return reply.status(404).send({ error: 'Task not found' });
      if (req.user.role !== 'ADMIN') {
        const ownsTask = await checkHierarchyAccess(
          req.user.id,
          task.created_by

        );
        if (!ownsTask)
          return reply
            .status(403)
            .send({ error: 'Task is not in your hierarchy' });
      }
      return repo.getProofsByTask(req.params.taskId);
    }
  );

  fastify.get('/my', { preHandler: [auth] }, async (req) => {
    return repo.getProofsByIntern(req.user.id);
  });
}

module.exports = routes;
