import { prisma } from '../lib/prisma.js';

function getConfiguredSuperAdminEmails() {
  const raw = process.env.SUPER_ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUserId(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export async function isSuperAdminUser(userPayload) {
  if (!userPayload) return false;

  const configuredEmails = getConfiguredSuperAdminEmails();

  // 1) Email whitelist check (normalized)
  const payloadEmail = normalizeEmail(userPayload.email);
  if (payloadEmail && configuredEmails.includes(payloadEmail)) {
    return true;
  }

  // 2) DB-backed checks (role/tenant/permissions)
  const userId = normalizeUserId(userPayload.id);
  if (!userId) return false;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      tenantId: true,
      permissions: true,
    },
  });

  if (!dbUser) return false;

  const dbEmail = normalizeEmail(dbUser.email);
  if (dbEmail && configuredEmails.includes(dbEmail)) {
    return true;
  }

  // Platform-level admin: ADMIN role not attached to tenant
  if (String(dbUser.role || '').toUpperCase() === 'ADMIN' && (dbUser.tenantId === null || dbUser.tenantId === undefined)) {
    return true;
  }

  // Optional explicit permission flags
  if (dbUser.permissions && typeof dbUser.permissions === 'object') {
    const flags = dbUser.permissions;
    if (flags.superAdmin === true || flags.canManageTenants === true) {
      return true;
    }
  }

  return false;
}

export async function requireSuperAdmin(req, res, next) {
  try {
    const allowed = await isSuperAdminUser(req.user);

    if (!allowed) {
      return res.status(403).json({
        error: 'Super admin access required',
        code: 'SUPER_ADMIN_REQUIRED',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}