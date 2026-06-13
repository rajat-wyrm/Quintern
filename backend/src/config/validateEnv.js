const REQUIRED_VARS = [
  { name: 'JWT_SECRET', minLength: 16 },
  { name: 'DATABASE_URL', minLength: 1 },
];

const OPTIONAL_VARS = [
  { name: 'JWT_ACCESS_SECRET', minLength: 16 },
  { name: 'JWT_REFRESH_SECRET', minLength: 16 },
  { name: 'CSRF_SECRET', minLength: 16, requiredInProd: true },
  { name: 'REDIS_URL' },
  { name: 'GOOGLE_CLIENT_ID' },
  { name: 'EMAIL_API_KEY' },
  { name: 'ANTHROPIC_API_KEY' },
];

function validateEnv() {
  // Skip validation in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const missingRequired = [];
  const missingOptional = [];
  const tooShort = [];

  for (const { name, minLength, requiredInProd } of REQUIRED_VARS) {
    const val = process.env[name];
    if (val === undefined || val === null || String(val).trim() === '') {
      missingRequired.push(name);
      continue;
    }
    if (minLength && String(val).length < minLength) {
      tooShort.push(`${name} (min ${minLength} chars, got ${String(val).length})`);
    }
  }

  for (const { name, minLength, requiredInProd: reqInProd } of OPTIONAL_VARS) {
    const val = process.env[name];
    if (val === undefined || val === null || String(val).trim() === '') {
      // If the variable is required in production, surface as a fatal error.
      if (isProd && reqInProd) {
        missingRequired.push(`${name} (required in production)`);
      } else {
        missingOptional.push(name);
      }
      continue;
    }
    if (minLength && String(val).length < minLength) {
      tooShort.push(`${name} (min ${minLength} chars, got ${String(val).length})`);
    }
  }

  if (missingOptional.length > 0) {
    console.warn('⚠️  Missing optional environment variables:');
    for (const key of missingOptional) {
      console.warn(`   • ${key}`);
    }
  }

  if (tooShort.length > 0) {
    console.error('❌ Variables below minimum length:');
    for (const m of tooShort) console.error(`   • ${m}`);
  }

  if (missingRequired.length > 0) {
    console.error('❌ Missing required environment variables:');
    for (const key of missingRequired) console.error(`   • ${key}`);
  }

  if (tooShort.length > 0) {
    console.error('❌ Variables below minimum length:');
    for (const m of tooShort) console.error(`   • ${m}`);
  }

  if (missingRequired.length > 0 || tooShort.length > 0) {
    console.error('❌ Refusing to start. Fix the above env issues and try again.');
    process.exit(1);
  }
}

module.exports = validateEnv;