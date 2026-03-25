import { prisma } from '../lib/prisma.js';

function getConfiguredSuperAdminEmails() {
  const raw = process.env.SUPER_ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export async function isSuperAdminUser(userPayload) {
  if (!userPayload?.id) return false;

  const configuredEmails = getConfiguredSuperAdminEmails();
  if (userPayload.email && configuredEmails.includes(String(userPayload.email).toLowerCase())) {
    return true;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userPayload.id },
    select: {
      id: true,
      email: true,
      role: true,
      tenantId: true,
      permissions: true,
    },
  });

  if (!dbUser) return false;

  // Platform-level admin: ADMIN role that is not attached to a tenant
  if (dbUser.role === 'ADMIN' && !dbUser.tenantId) {
    return true;
  }

  // Optional explicit permission flag
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
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  } catch (err) {
    next(err);
  }
}
