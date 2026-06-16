// Cloudinary upload helper — uses the HTTPS upload API directly so we don't
// add a runtime dependency. Returns { url, public_id, width, height, format }.
const crypto = require('crypto');
const config = require('../../config');

function isConfigured() {
  return !!(
    config.cloudinary &&
    config.cloudinary.cloudName &&
    config.cloudinary.apiKey &&
    config.cloudinary.apiSecret
  );
}

function signParams(params) {
  // Build query string of params sorted alphabetically, then append API secret.
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto
    .createHash('sha1')
    .update(sorted + config.cloudinary.apiSecret)
    .digest('hex');
}

async function uploadBuffer(
  buffer,
  { folder, resourceType = 'image', publicId } = {}
) {
  if (!isConfigured()) throw new Error('cloudinary-not-configured');

  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    timestamp,
    folder: folder || config.cloudinary.folder,
  };
  if (publicId) params.public_id = publicId;
  const signature = signParams(params);

  const form = new FormData();
  form.append('file', new Blob([buffer]));
  form.append('api_key', config.cloudinary.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', params.folder);
  if (publicId) form.append('public_id', publicId);
  form.append('signature', signature);

  const url = `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/${resourceType}/upload`;
  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`cloudinary-${res.status} ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    url: data.secure_url,
    public_id: data.public_id,
    width: data.width,
    height: data.height,
    format: data.format,
    bytes: data.bytes,
  };
}

module.exports = { isConfigured, uploadBuffer, signParams };
