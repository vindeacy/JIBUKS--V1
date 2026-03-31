import dotenv from 'dotenv';

const result = dotenv.config({ override: true });

if (result.error) {
  console.error('Failed to load .env:', result.error);
} else {
  console.log('Environment variables loaded with override.');
}

const raw = process.env.SUPER_ADMIN_EMAILS || '';
const parsed = raw
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

console.log('SUPER_ADMIN_EMAILS raw:', raw);
console.log('SUPER_ADMIN_EMAILS parsed:', parsed);

// optional strict check in dev
if ((process.env.NODE_ENV || 'development') !== 'production' && parsed.length === 0) {
  console.warn('WARNING: SUPER_ADMIN_EMAILS is empty. Super-admin email whitelist will not work.');
}