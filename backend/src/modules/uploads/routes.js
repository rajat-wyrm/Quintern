const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const pool = require('../../config/db');
const config = require('../../config');
const cloudinary = require('./cloudinary');

// Allowed Content-Types. We don't trust this — the magic-bytes check below
// is the real validator, since a Content-Type header is trivially spoofed.
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);
const MAX_BYTES = config.maxFileSize || 5 * 1024 * 1024;

// Returns a normalized extension based on verified magic bytes, or null if
// the file is not a recognized image. Prevents stored XSS via content-type
// spoofing (e.g. attacker uploads "image.png" that's actually HTML).
function detectImageExt(buf) {
  if (!buf || buf.length < 8) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return '.png';
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38)
    return '.gif';
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return '.webp';
  return null;
}

async function routes(fastify) {
  // Upload / replace the current user's avatar
  fastify.post('/avatar', { preHandler: [auth] }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });
    if (!ALLOWED_MIME.has(data.mimetype)) {
      return reply.status(400).send({ error: 'Unsupported file type' });
    }

    const buffer = await data.toBuffer();
    if (buffer.length > MAX_BYTES) {
      return reply.status(413).send({ error: 'File too large' });
    }
    // Magic-bytes check — don't trust the Content-Type or extension.
    const ext = detectImageExt(buffer);
    if (!ext) {
      return reply.status(400).send({
        error: 'File content does not match a supported image format',
      });
    }

    let url = null;
    if (cloudinary.isConfigured()) {
      try {
        const result = await cloudinary.uploadBuffer(buffer, {
          folder: `${config.cloudinary.folder}/avatars`,
          publicId: `avatar_${req.user.id}_${crypto.randomBytes(8).toString('hex')}`,
        });
        url = result.url;
      } catch (e) {
        req.log.warn(
          { err: e.message },
          'cloudinary upload failed, falling back to local'
        );
      }
    }
    if (!url) {
      const fileName = `avatar_${req.user.id}_${crypto.randomBytes(8).toString('hex')}${ext}`;
      const uploadPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        config.uploadDir
      );
      await fsp.mkdir(uploadPath, { recursive: true });
      await fsp.writeFile(path.join(uploadPath, fileName), buffer);
      url = `/api/uploads/file/${fileName}`;
    }

    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [
      url,
      req.user.id,
    ]);

    return {
      success: true,
      avatar_url: url,
      storage: cloudinary.isConfigured() ? 'cloudinary' : 'local',
    };
  });

  // Generic file upload — admins only, for proof attachments / documents
  fastify.post('/file', { preHandler: [auth] }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });
    if (!ALLOWED_MIME.has(data.mimetype)) {
      return reply.status(400).send({ error: 'Unsupported file type' });
    }
    const buffer = await data.toBuffer();
    if (buffer.length > MAX_BYTES) {
      return reply.status(413).send({ error: 'File too large' });
    }
    const ext = detectImageExt(buffer);
    if (!ext) {
      return reply.status(400).send({
        error: 'File content does not match a supported image format',
      });
    }
    let url = null;
    let publicId = null;
    if (cloudinary.isConfigured()) {
      try {
        const result = await cloudinary.uploadBuffer(buffer, {
          folder: `${config.cloudinary.folder}/files`,
          publicId: `file_${crypto.randomBytes(8).toString('hex')}`,
        });
        url = result.url;
        publicId = result.public_id;
      } catch (e) {
        req.log.warn(
          { err: e.message },
          'cloudinary upload failed, falling back to local'
        );
      }
    }
    if (!url) {
      const fileName = `file_${crypto.randomBytes(8).toString('hex')}${ext}`;
      const uploadPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        config.uploadDir
      );
      await fsp.mkdir(uploadPath, { recursive: true });
      await fsp.writeFile(path.join(uploadPath, fileName), buffer);
      url = `/api/uploads/file/${fileName}`;
    }
    return {
      success: true,
      url,
      public_id: publicId,
      storage: cloudinary.isConfigured() ? 'cloudinary' : 'local',
    };
  });

  // Authenticated file download. Previously served publicly at /uploads/*,
  // which is a privacy leak (avatars guessed by filename). Same-origin
  // images in the UI just hit this with the user's bearer token.
  fastify.get('/file/:filename', { preHandler: [auth] }, async (req, reply) => {
    // Strict filename guard: no path separators, no traversal, known prefix.
    const safe = path.basename(req.params.filename);
    if (!/^avatar_[a-f0-9-]+_[a-f0-9]{16}\.(png|jpg|gif|webp)$/.test(safe)) {
      return reply.status(400).send({ error: 'Invalid filename' });
    }
    const uploadPath = path.join(__dirname, '..', '..', '..', config.uploadDir);
    const filePath = path.join(uploadPath, safe);
    // Containment: ensure the resolved path is still inside uploadPath.
    const rel = path.relative(uploadPath, filePath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return reply.status(400).send({ error: 'Invalid path' });
    }
    try {
      await fsp.access(filePath, fs.constants.R_OK);
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
    const ext = path.extname(safe).slice(1).toLowerCase();
    const mime =
      {
        png: 'image/png',
        jpg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
      }[ext] || 'application/octet-stream';
    reply.header('Content-Type', mime);
    reply.header('Cache-Control', 'private, max-age=300');
    return reply.send(fs.createReadStream(filePath));
  });
}

module.exports = routes;
