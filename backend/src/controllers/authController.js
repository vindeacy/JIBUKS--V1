import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { generateToken, generateRefreshToken, JWT_SECRET } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { sendEmail } from '../services/emailService.js';
import {
  seedFamilyCoA,
  seedFamilyCategories,
  seedFamilyPaymentMethods,
  seedVATRates,
  seedDefaultSuppliers
} from '../services/accountingService.js';
import { isSuperAdminUser } from '../middleware/superAdmin.js';
import crypto from 'crypto';

// Use lower salt rounds in development for faster login
const SALT_ROUNDS = process.env.NODE_ENV === 'production' ? 10 : 6;

async function logLoginAudit({ userId = null, req, successful }) {
  try {
    await prisma.loginAudit.create({
      data: {
        userId,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        userAgent: req.headers['user-agent'] || null,
        successful,
      },
    });
  } catch (error) {
    console.error('[LoginAudit] Failed to write login audit:', error.message);
  }
}

/**
 * Local login with email/password (fallback)
 */
async function login(req, res, next) {
  const startTime = Date.now();
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    console.log(`[Login] Finding user: ${email}`);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`[Login] User not found: ${email}`);
      await logLoginAudit({ req, successful: false });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log(`[Login] User found, comparing password...`);

    const match = await bcrypt.compare(password, user.password || '');
    if (!match) {
      console.log(`[Login] Password mismatch for: ${email}`);
      await logLoginAudit({ userId: user.id, req, successful: false });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log(`[Login] Password matched, generating tokens...`);

    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    const isSuperAdmin = await isSuperAdminUser(user);

    let tenantType = null;
    if (user.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { tenantType: true },
      });
      tenantType = tenant?.tenantType ?? null;
    }

    const duration = Date.now() - startTime;
    console.log(`[Login] ✅ Success for ${email} (${duration}ms)`);

    await logLoginAudit({ userId: user.id, req, successful: true });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role,
        tenantType,
        isSuperAdmin,
      },
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[Login] ❌ Error after ${duration}ms:`, err);
    next(err);
  }
}

/**
 * Register new user with email/password
 */
async function register(req, res, next) {
  try {
    const { firstName, lastName, email, phone, password, confirmPassword, tenantSlug, tenantType } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    let tenant;

    // If tenantSlug is provided, try to join existing tenant
    let role = 'MEMBER';
    if (tenantSlug) {
      tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug }
      });

      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found. Please check the tenant slug and try again.' });
      }
    } else {
      // Create a new tenant for this user (tenant type from signup)
      const allowed = ['FAMILY', 'BUSINESS'];
      const type = allowed.includes(tenantType) ? tenantType : 'FAMILY';
      tenant = await prisma.tenant.create({
        data: {
          name: `${firstName} ${lastName}`,
          slug: email.split('@')[0],
          ownerEmail: email,
          tenantType: type,
        },
      });
      role = 'OWNER';

      // Seed Chart of Accounts for the new family
      try {
        await seedFamilyCoA(tenant.id);
        console.log(`[Auth] Seeded CoA for new family tenant ${tenant.id}`);
      } catch (coaError) {
        console.error('[Auth] Failed to seed CoA:', coaError);
        // Don't fail registration if CoA seeding fails
      }

      // Seed Categories for the new family
      try {
        await seedFamilyCategories(tenant.id);
        console.log(`[Auth] Seeded categories for new family tenant ${tenant.id}`);
      } catch (catError) {
        console.error('[Auth] Failed to seed categories:', catError);
        // Don't fail registration if category seeding fails
      }

      // Seed Payment Methods for the new family
      try {
        await seedFamilyPaymentMethods(tenant.id);
        console.log(`[Auth] Seeded payment methods for new family tenant ${tenant.id}`);
      } catch (pmError) {
        console.error('[Auth] Failed to seed payment methods:', pmError);
        // Don't fail registration if payment method seeding fails
      }

      // Seed VAT Rates for the new tenant
      try {
        await seedVATRates(tenant.id);
        console.log(`[Auth] Seeded VAT rates for new tenant ${tenant.id}`);
      } catch (vatError) {
        console.error('[Auth] Failed to seed VAT rates:', vatError);
        // Don't fail registration if VAT seeding fails
      }

      // Seed Default Suppliers for the new tenant
      try {
        await seedDefaultSuppliers(tenant.id);
        console.log(`[Auth] Seeded default suppliers for new tenant ${tenant.id}`);
      } catch (supplierError) {
        console.error('[Auth] Failed to seed suppliers:', supplierError);
        // Don't fail registration if supplier seeding fails
      }

      // Seed Item Types for the new tenant
      try {
        const { seedItemTypes } = await import('../services/accountingService.js');
        await seedItemTypes(tenant.id);
        console.log(`[Auth] Seeded item types for new tenant ${tenant.id}`);
      } catch (itemTypeError) {
        console.error('[Auth] Failed to seed item types:', itemTypeError);
      }
    }

    // Create user record
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name: `${firstName} ${lastName}`,
        phone: phone || null,
        password: hashedPassword,
        role: role,
      },
    });

    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    const isSuperAdmin = await isSuperAdminUser(user);

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role,
        tenantType: tenant.tenantType,
        isSuperAdmin,
      },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'User already exists' });
    }
    next(err);
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshToken(req, res, next) {
  try {
    let { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken required' });
    }

    // Robustness: Trim and remove "Bearer " prefix if accidentally included
    refreshToken = refreshToken.trim();
    if (refreshToken.toLowerCase().startsWith('bearer ')) {
      refreshToken = refreshToken.slice(7).trim();
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      const newAccessToken = generateToken(user);

      res.json({ accessToken: newAccessToken });
    } catch (err) {
      console.error('[Auth] Refresh token verification failed:', err.message);
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Get current user from JWT
 */
async function getCurrentUser(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        tenant: { select: { tenantType: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isSuperAdmin = await isSuperAdminUser(user);
    const { tenant, ...rest } = user;
    res.json({ ...rest, tenantType: tenant?.tenantType ?? null, isSuperAdmin });
  } catch (err) {
    next(err);
  }
}

/**
 * Logout (invalidate refresh token in production)
 */
async function logout(req, res, next) {
  try {
    // In production, add refreshToken to blacklist
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}



/**
 * Forgot Password - Send OTP
 */
async function forgotPassword(req, res, next) {
  try {
    const { email, phone, deliveryMethod } = req.body;

    // Validate input based on delivery method
    if (deliveryMethod === 'sms') {
      if (!phone) {
        return res.status(400).json({ error: 'Phone number is required for SMS delivery' });
      }
    } else {
      if (!email) {
        return res.status(400).json({ error: 'Email is required for email delivery' });
      }
    }

    // Find user by email or phone
    let user;
    if (deliveryMethod === 'sms' && phone) {
      user = await prisma.user.findFirst({ where: { phone } });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    }

    if (!user) {
      return res.json({ message: 'If that contact is in our system, we sent an OTP.' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordOtp: otp,
        resetPasswordExpires: expires,
      },
    });

    // Send OTP via selected method
    if (deliveryMethod === 'sms' && user.phone) {
      const { sendOtpSMS } = await import('../services/smsService.js');
      await sendOtpSMS(user.phone, otp);
      res.json({ message: 'OTP sent to phone number' });
    } else {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset OTP',
        text: `Your OTP for password reset is: ${otp}`,
        html: `<p>Your OTP for password reset is: <strong>${otp}</strong></p><p>This code expires in 15 minutes.</p>`,
      });
      res.json({ message: 'OTP sent to email' });
    }
  } catch (err) {
    next(err);
  }
}


/**
 * Verify OTP
 */
async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (user.resetPasswordOtp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    res.json({ message: 'OTP verified' });
  } catch (err) {
    next(err);
  }
}

/**
 * Reset Password
 */
async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (user.resetPasswordOtp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordOtp: null,
        resetPasswordExpires: null,
      },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}

export {
  register,
  login,
  refreshToken,
  getCurrentUser,
  logout,
  forgotPassword,
  verifyOtp,
  resetPassword,
};
