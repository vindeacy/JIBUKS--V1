import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { isSuperAdminUser } from './superAdmin.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware to verify JWT token from Authorization header
 * Expected format: Authorization: Bearer <token>
 */
async function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Multi-tenant governance: block suspended tenant users by default.
    // Super admins are exempt.
    if (decoded?.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: decoded.tenantId },
        select: { id: true, metadata: true },
      });

      if (!tenant) {
        return res.status(401).json({ error: 'Tenant not found for user' });
      }

      const metadata = tenant.metadata && typeof tenant.metadata === 'object' ? tenant.metadata : {};
      const platformStatus = metadata.platformStatus || 'ACTIVE';

      if (platformStatus === 'SUSPENDED') {
        const superAdmin = await isSuperAdminUser(decoded);
        if (!superAdmin) {
          return res.status(403).json({
            error: 'Tenant access is suspended. Contact support.',
            code: 'TENANT_SUSPENDED',
          });
        }
      }
    }

    req.user = decoded; // Attach user to request
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Generate JWT token for a user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      auth0Id: user.auth0Id,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Generate refresh token (longer expiry)
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Export individual functions (named exports)
export {
  verifyJWT,
  generateToken,
  generateRefreshToken,
  JWT_SECRET,
};