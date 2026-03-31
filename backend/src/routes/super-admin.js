import express from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyJWT } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/superAdmin.js';

const router = express.Router();

router.use(verifyJWT);
router.use(requireSuperAdmin);

// Super-admin data must always be fresh (no browser/proxy cache)
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  // Prevent 304 responses based on stale ETag for admin dashboards
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  next();
});

async function logPlatformAudit({
  tenantId = null,
  actorUserId = null,
  action,
  entityType,
  entityId = null,
  reason = null,
  oldValue = null,
  newValue = null,
  metadata = null,
}) {
  try {
    await prisma.platformAuditLog.create({
      data: {
        tenantId,
        actorUserId,
        action,
        entityType,
        entityId,
        reason,
        oldValue,
        newValue,
        metadata,
      },
    });
  } catch (error) {
    // Do not block core operation if audit insert fails
    console.error('Platform audit log write failed:', error);
  }
}

router.get('/me', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        permissions: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user,
      scopes: {
        canManageTenants: true,
        canViewGlobalAnalytics: true,
        canViewCompliance: true,
        canViewAudit: true,
      },
    });
  } catch (error) {
    console.error('Error fetching super admin profile:', error);
    res.status(500).json({ error: 'Failed to fetch super admin profile' });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const startDate = req.query.startDate
      ? new Date(String(req.query.startDate))
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

    const [
      tenantCounts,
      userCount,
      txAgg,
      invoiceAgg,
      journalsCount,
      suspendedTenants,
    ] = await Promise.all([
      prisma.tenant.groupBy({ by: ['tenantType'], _count: { id: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.transaction.aggregate({
        where: { date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.invoice.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.journal.count({ where: { date: { gte: startDate, lte: endDate } } }),
      prisma.tenant.count({
        where: {
          metadata: {
            path: ['platformStatus'],
            equals: 'SUSPENDED',
          },
        },
      }),
    ]);

    const byType = tenantCounts.reduce((acc, row) => {
      acc[row.tenantType] = row._count.id;
      return acc;
    }, {});

    res.json({
      period: { startDate, endDate },
      cards: {
        totalTenants: tenantCounts.reduce((a, c) => a + c._count.id, 0),
        familyTenants: byType.FAMILY || 0,
        businessTenants: byType.BUSINESS || 0,
        activeUsers: userCount,
        suspendedTenants,
        transactionsCount: txAgg._count.id || 0,
        transactionsVolume: Number(txAgg._sum.amount || 0),
        invoicesCount: invoiceAgg._count.id || 0,
        invoicesVolume: Number(invoiceAgg._sum.total || 0),
        journalsCount,
      },
    });
  } catch (error) {
    console.error('Error loading super admin dashboard:', error);
    res.status(500).json({ error: 'Failed to load super admin dashboard' });
  }
});

router.get('/tenants', async (req, res) => {
  try {
    const { search, tenantType, limit = 50, offset = 0 } = req.query;
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = parseInt(offset, 10) || 0;

    const where = {
      ...(tenantType && { tenantType }),
      ...(search
        ? {
            OR: [
              { name: { contains: String(search), mode: 'insensitive' } },
              { slug: { contains: String(search), mode: 'insensitive' } },
              { ownerEmail: { contains: String(search), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, tenants] = await Promise.all([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              transactions: true,
              journals: true,
              invoices: true,
              purchases: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ]);

    res.json({
      total,
      limit: take,
      offset: skip,
      tenants,
    });
  } catch (error) {
    console.error('Error listing tenants (super admin):', error);
    res.status(500).json({ error: 'Failed to list tenants' });
  }
});

router.get('/tenants/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid tenantId' });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: {
          select: {
            users: true,
            transactions: true,
            journals: true,
            invoices: true,
            purchases: true,
            inventoryItems: true,
            customers: true,
            vendors: true,
          },
        },
      },
    });

    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const [transactionVolume, invoiceVolume] = await Promise.all([
      prisma.transaction.aggregate({
        where: { tenantId },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { tenantId },
        _sum: { total: true },
      }),
    ]);

    res.json({
      ...tenant,
      metrics: {
        transactionVolume: Number(transactionVolume._sum.amount || 0),
        invoiceVolume: Number(invoiceVolume._sum.total || 0),
      },
    });
  } catch (error) {
    console.error('Error getting tenant detail (super admin):', error);
    res.status(500).json({ error: 'Failed to get tenant detail' });
  }
});

router.get('/tenants/:tenantId/users', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid tenantId' });

    const { limit = 50, offset = 0, search } = req.query;
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = parseInt(offset, 10) || 0;

    const where = {
      tenantId,
      ...(search
        ? {
            OR: [
              { name: { contains: String(search), mode: 'insensitive' } },
              { email: { contains: String(search), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ]);

    res.json({ total, limit: take, offset: skip, users });
  } catch (error) {
    console.error('Error listing tenant users (super admin):', error);
    res.status(500).json({ error: 'Failed to list tenant users' });
  }
});

router.patch('/tenants/:tenantId/users/:userId/status', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    const userId = parseInt(req.params.userId, 10);
    const { isActive } = req.body;

    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Invalid tenantId or userId' });
    }
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be boolean' });
    }

    const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) return res.status(404).json({ error: 'User not found in tenant' });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        tenantId: true,
        updatedAt: true,
      },
    });

    await logPlatformAudit({
      tenantId,
      actorUserId: req.user?.id ?? null,
      action: 'TENANT_USER_STATUS_UPDATED',
      entityType: 'USER',
      entityId: String(userId),
      reason: req.body?.reason || null,
      oldValue: {
        isActive: user.isActive,
        role: user.role,
      },
      newValue: {
        isActive: updated.isActive,
        role: updated.role,
      },
      metadata: {
        actorEmail: req.user?.email || null,
      },
    });

    res.json({ message: 'User status updated', user: updated });
  } catch (error) {
    console.error('Error updating tenant user status (super admin):', error);
    res.status(500).json({ error: 'Failed to update tenant user status' });
  }
});

router.patch('/tenants/:tenantId/status', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid tenantId' });

    const { status, note } = req.body;
    const allowedStatuses = ['ACTIVE', 'SUSPENDED', 'UNDER_REVIEW'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowedStatuses.join(', ')}` });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const existingMetadata = tenant.metadata && typeof tenant.metadata === 'object' ? tenant.metadata : {};
    const previousStatus = existingMetadata.platformStatus || 'ACTIVE';
    const updatedMetadata = {
      ...existingMetadata,
      platformStatus: status,
      platformStatusUpdatedAt: new Date().toISOString(),
      platformStatusUpdatedBy: req.user?.email || req.user?.id,
      ...(note ? { platformStatusNote: note } : {}),
    };

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: updatedMetadata },
      select: { id: true, name: true, slug: true, tenantType: true, metadata: true, updatedAt: true },
    });

    await logPlatformAudit({
      tenantId,
      actorUserId: req.user?.id ?? null,
      action: 'TENANT_STATUS_UPDATED',
      entityType: 'TENANT',
      entityId: String(tenantId),
      reason: note || null,
      oldValue: {
        platformStatus: previousStatus,
      },
      newValue: {
        platformStatus: status,
      },
      metadata: {
        actorEmail: req.user?.email || null,
      },
    });

    res.json({ message: 'Tenant platform status updated', tenant: updated });
  } catch (error) {
    console.error('Error updating tenant status (super admin):', error);
    res.status(500).json({ error: 'Failed to update tenant status' });
  }
});

router.get('/tenants/:tenantId/metrics', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid tenantId' });

    const startDate = req.query.startDate
      ? new Date(String(req.query.startDate))
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

    const [
      txAgg,
      invoiceAgg,
      purchaseAgg,
      activeUsers,
      unpaidInvoices,
      unpaidPurchases,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: { tenantId, date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.invoice.aggregate({
        where: { tenantId, invoiceDate: { gte: startDate, lte: endDate } },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
      prisma.purchase.aggregate({
        where: { tenantId, purchaseDate: { gte: startDate, lte: endDate } },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
      prisma.user.count({ where: { tenantId, isActive: true } }),
      prisma.invoice.count({ where: { tenantId, status: { in: ['UNPAID', 'PARTIAL'] } } }),
      prisma.purchase.count({ where: { tenantId, status: { in: ['UNPAID', 'PARTIAL'] } } }),
    ]);

    res.json({
      tenantId,
      period: { startDate, endDate },
      users: { active: activeUsers },
      transactions: {
        count: txAgg._count.id || 0,
        volume: Number(txAgg._sum.amount || 0),
      },
      invoicing: {
        count: invoiceAgg._count.id || 0,
        billed: Number(invoiceAgg._sum.total || 0),
        paid: Number(invoiceAgg._sum.amountPaid || 0),
        outstanding: Number(invoiceAgg._sum.total || 0) - Number(invoiceAgg._sum.amountPaid || 0),
        unpaidCount: unpaidInvoices,
      },
      purchasing: {
        count: purchaseAgg._count.id || 0,
        billed: Number(purchaseAgg._sum.total || 0),
        paid: Number(purchaseAgg._sum.amountPaid || 0),
        outstanding: Number(purchaseAgg._sum.total || 0) - Number(purchaseAgg._sum.amountPaid || 0),
        unpaidCount: unpaidPurchases,
      },
    });
  } catch (error) {
    console.error('Error generating tenant metrics (super admin):', error);
    res.status(500).json({ error: 'Failed to generate tenant metrics' });
  }
});

router.get('/tenants/:tenantId/compliance', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid tenantId' });

    const [tenant, vatRates, journals, invoices, purchases, users] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, tenantType: true, metadata: true, createdAt: true, updatedAt: true },
      }),
      prisma.vatRate.count({ where: { tenantId, isActive: true } }),
      prisma.journal.count({ where: { tenantId } }),
      prisma.invoice.count({ where: { tenantId } }),
      prisma.purchase.count({ where: { tenantId } }),
      prisma.user.count({ where: { tenantId, isActive: true } }),
    ]);

    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const md = tenant.metadata && typeof tenant.metadata === 'object' ? tenant.metadata : {};
    const checks = {
      hasActiveUsers: users > 0,
      hasAccountingActivity: journals > 0,
      hasVatRates: vatRates > 0,
      hasKraPin: Boolean(md.kraPin),
      hasInvoiceData: invoices > 0,
      hasPurchaseData: purchases > 0,
    };

    const passed = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;

    res.json({
      tenant,
      checks,
      score: passed,
      scoreOutOf: totalChecks,
      riskLevel: passed <= 2 ? 'HIGH' : passed <= 4 ? 'MEDIUM' : 'LOW',
    });
  } catch (error) {
    console.error('Error generating tenant compliance (super admin):', error);
    res.status(500).json({ error: 'Failed to generate tenant compliance' });
  }
});

router.get('/tenants/:tenantId/audits/activity', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid tenantId' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    const [journals, stockMovements, bankTransactions, platformAudits] = await Promise.all([
      prisma.journal.findMany({
        where: { tenantId },
        select: {
          id: true,
          tenantId: true,
          date: true,
          description: true,
          reference: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.stockMovement.findMany({
        where: { tenantId },
        select: {
          id: true,
          tenantId: true,
          type: true,
          reason: true,
          quantity: true,
          reference: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.bankTransaction.findMany({
        where: { tenantId },
        select: {
          id: true,
          tenantId: true,
          type: true,
          amount: true,
          reference: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.platformAuditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const normalized = [
      ...journals.map((j) => ({
        source: 'JOURNAL',
        id: j.id,
        tenantId: j.tenantId,
        timestamp: j.createdAt,
        summary: j.description,
        reference: j.reference,
        payload: j,
      })),
      ...stockMovements.map((s) => ({
        source: 'STOCK_MOVEMENT',
        id: s.id,
        tenantId: s.tenantId,
        timestamp: s.createdAt,
        summary: `${s.type}${s.reason ? ` / ${s.reason}` : ''}`,
        reference: s.reference,
        payload: s,
      })),
      ...bankTransactions.map((b) => ({
        source: 'BANK_TRANSACTION',
        id: b.id,
        tenantId: b.tenantId,
        timestamp: b.createdAt,
        summary: `${b.type} ${Number(b.amount)}`,
        reference: b.reference,
        payload: b,
      })),
      ...platformAudits.map((a) => ({
        source: 'PLATFORM_AUDIT',
        id: a.id,
        tenantId: a.tenantId,
        timestamp: a.createdAt,
        summary: a.action,
        reference: a.entityId,
        payload: a,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    res.json({
      tenantId,
      total: normalized.length,
      items: normalized,
    });
  } catch (error) {
    console.error('Error fetching tenant audit activity (super admin):', error);
    res.status(500).json({ error: 'Failed to fetch tenant audit activity' });
  }
});

router.get('/billing/overview', async (req, res) => {
  try {
    const startDate = req.query.startDate
      ? new Date(String(req.query.startDate))
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

    const now = new Date();
    const dueSoon = new Date();
    dueSoon.setDate(dueSoon.getDate() + 7);

    const [
      invoiceAgg,
      purchaseAgg,
      overdueInvoices,
      overduePurchases,
      dueSoonInvoices,
      dueSoonPurchases,
      invoiceByTenant,
      purchaseByTenant,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
      prisma.purchase.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
      prisma.invoice.count({
        where: {
          dueDate: { lt: now },
          status: { in: ['OVERDUE', 'UNPAID', 'PARTIAL'] },
        },
      }),
      prisma.purchase.count({
        where: {
          dueDate: { lt: now },
          status: { in: ['UNPAID', 'PARTIAL'] },
        },
      }),
      prisma.invoice.count({
        where: {
          dueDate: { gte: now, lte: dueSoon },
          status: { in: ['OVERDUE', 'UNPAID', 'PARTIAL'] },
        },
      }),
      prisma.purchase.count({
        where: {
          dueDate: { gte: now, lte: dueSoon },
          status: { in: ['UNPAID', 'PARTIAL'] },
        },
      }),
      prisma.invoice.groupBy({
        by: ['tenantId'],
        _sum: { total: true, amountPaid: true },
      }),
      prisma.purchase.groupBy({
        by: ['tenantId'],
        _sum: { total: true, amountPaid: true },
      }),
    ]);

    const tenantMap = new Map();
    for (const row of invoiceByTenant) {
      tenantMap.set(row.tenantId, {
        tenantId: row.tenantId,
        receivableTotal: Number(row._sum.total || 0),
        receivablePaid: Number(row._sum.amountPaid || 0),
        payableTotal: 0,
        payablePaid: 0,
      });
    }

    for (const row of purchaseByTenant) {
      const existing = tenantMap.get(row.tenantId) || {
        tenantId: row.tenantId,
        receivableTotal: 0,
        receivablePaid: 0,
        payableTotal: 0,
        payablePaid: 0,
      };
      existing.payableTotal = Number(row._sum.total || 0);
      existing.payablePaid = Number(row._sum.amountPaid || 0);
      tenantMap.set(row.tenantId, existing);
    }

    const tenantIds = Array.from(tenantMap.keys());
    const tenants = tenantIds.length
      ? await prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true, slug: true, tenantType: true },
        })
      : [];
    const byId = new Map(tenants.map((t) => [t.id, t]));

    const topTenantExposure = Array.from(tenantMap.values())
      .map((row) => {
        const receivableOutstanding = Math.max(0, row.receivableTotal - row.receivablePaid);
        const payableOutstanding = Math.max(0, row.payableTotal - row.payablePaid);
        return {
          tenantId: row.tenantId,
          tenant: byId.get(row.tenantId) || null,
          receivableOutstanding,
          payableOutstanding,
          netExposure: receivableOutstanding - payableOutstanding,
        };
      })
      .sort((a, b) => Math.abs(b.netExposure) - Math.abs(a.netExposure))
      .slice(0, 10);

    const invoicesTotal = Number(invoiceAgg._sum.total || 0);
    const invoicesPaid = Number(invoiceAgg._sum.amountPaid || 0);
    const purchasesTotal = Number(purchaseAgg._sum.total || 0);
    const purchasesPaid = Number(purchaseAgg._sum.amountPaid || 0);

    res.json({
      period: { startDate, endDate },
      totals: {
        invoiceCount: invoiceAgg._count.id || 0,
        invoiceTotal: invoicesTotal,
        invoicePaid: invoicesPaid,
        invoiceOutstanding: Math.max(0, invoicesTotal - invoicesPaid),
        purchaseCount: purchaseAgg._count.id || 0,
        purchaseTotal: purchasesTotal,
        purchasePaid: purchasesPaid,
        purchaseOutstanding: Math.max(0, purchasesTotal - purchasesPaid),
      },
      risk: {
        overdueInvoices,
        overduePurchases,
        dueSoonInvoices,
        dueSoonPurchases,
      },
      topTenantExposure,
    });
  } catch (error) {
    console.error('Error generating billing overview (super admin):', error);
    res.status(500).json({ error: 'Failed to generate billing overview' });
  }
});

router.get('/tenants/:tenantId/billing', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid tenantId' });

    const [tenant, invoiceAgg, purchaseAgg, overdueInvoices, overduePurchases, recentInvoices, recentPurchases] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, tenantType: true },
      }),
      prisma.invoice.aggregate({
        where: { tenantId },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
      prisma.purchase.aggregate({
        where: { tenantId },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
      prisma.invoice.count({
        where: {
          tenantId,
          dueDate: { lt: new Date() },
          status: { in: ['OVERDUE', 'UNPAID', 'PARTIAL'] },
        },
      }),
      prisma.purchase.count({
        where: {
          tenantId,
          dueDate: { lt: new Date() },
          status: { in: ['UNPAID', 'PARTIAL'] },
        },
      }),
      prisma.invoice.findMany({
        where: { tenantId },
        select: {
          id: true,
          invoiceNumber: true,
          dueDate: true,
          total: true,
          amountPaid: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.purchase.findMany({
        where: { tenantId },
        select: {
          id: true,
          billNumber: true,
          dueDate: true,
          total: true,
          amountPaid: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ]);

    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const invoiceTotal = Number(invoiceAgg._sum.total || 0);
    const invoicePaid = Number(invoiceAgg._sum.amountPaid || 0);
    const purchaseTotal = Number(purchaseAgg._sum.total || 0);
    const purchasePaid = Number(purchaseAgg._sum.amountPaid || 0);

    res.json({
      tenant,
      summary: {
        invoiceCount: invoiceAgg._count.id || 0,
        invoiceTotal,
        invoicePaid,
        invoiceOutstanding: Math.max(0, invoiceTotal - invoicePaid),
        purchaseCount: purchaseAgg._count.id || 0,
        purchaseTotal,
        purchasePaid,
        purchaseOutstanding: Math.max(0, purchaseTotal - purchasePaid),
        overdueInvoices,
        overduePurchases,
      },
      recent: {
        invoices: recentInvoices.map((row) => ({
          ...row,
          total: Number(row.total || 0),
          amountPaid: Number(row.amountPaid || 0),
          outstanding: Math.max(0, Number(row.total || 0) - Number(row.amountPaid || 0)),
        })),
        purchases: recentPurchases.map((row) => ({
          ...row,
          total: Number(row.total || 0),
          amountPaid: Number(row.amountPaid || 0),
          outstanding: Math.max(0, Number(row.total || 0) - Number(row.amountPaid || 0)),
        })),
      },
    });
  } catch (error) {
    console.error('Error generating tenant billing summary (super admin):', error);
    res.status(500).json({ error: 'Failed to generate tenant billing summary' });
  }
});

router.get('/analytics/overview', async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

    const [
      tenantCounts,
      activeUsers,
      txAgg,
      invoiceAgg,
      topTenantTransactions,
    ] = await Promise.all([
      prisma.tenant.groupBy({ by: ['tenantType'], _count: { id: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.transaction.aggregate({
        where: { date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.invoice.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.transaction.groupBy({
        by: ['tenantId'],
        where: { date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
    ]);

    const tenantIds = topTenantTransactions.map((t) => t.tenantId);
    const tenantMap = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true, slug: true, tenantType: true },
    });
    const byId = new Map(tenantMap.map((t) => [t.id, t]));

    res.json({
      period: { startDate, endDate },
      totals: {
        tenants: tenantCounts.reduce((a, c) => a + c._count.id, 0),
        activeUsers,
        transactionsCount: txAgg._count.id || 0,
        transactionsVolume: Number(txAgg._sum.amount || 0),
        invoicesCount: invoiceAgg._count.id || 0,
        invoicesVolume: Number(invoiceAgg._sum.total || 0),
      },
      tenantBreakdown: tenantCounts,
      topTenantsByTransactionVolume: topTenantTransactions.map((row) => ({
        tenantId: row.tenantId,
        tenant: byId.get(row.tenantId) || null,
        transactionsCount: row._count.id,
        transactionVolume: Number(row._sum.amount || 0),
      })),
    });
  } catch (error) {
    console.error('Error generating analytics overview (super admin):', error);
    res.status(500).json({ error: 'Failed to generate analytics overview' });
  }
});

router.get('/compliance/overview', async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        tenantType: true,
        metadata: true,
        _count: {
          select: {
            vatRates: true,
            journals: true,
            users: true,
          },
        },
      },
    });

    const complianceRows = tenants.map((t) => {
      const md = t.metadata && typeof t.metadata === 'object' ? t.metadata : {};
      const hasVatRates = t._count.vatRates > 0;
      const hasJournals = t._count.journals > 0;
      const hasUsers = t._count.users > 0;
      const hasKraPin = Boolean(md.kraPin);

      const score = [hasVatRates, hasJournals, hasUsers, hasKraPin].filter(Boolean).length;
      return {
        tenantId: t.id,
        tenantName: t.name,
        tenantType: t.tenantType,
        checks: {
          hasUsers,
          hasJournals,
          hasVatRates,
          hasKraPin,
        },
        score,
        scoreOutOf: 4,
      };
    });

    res.json({
      totalTenants: complianceRows.length,
      tenantsAtRisk: complianceRows.filter((r) => r.score <= 2).length,
      rows: complianceRows.sort((a, b) => a.score - b.score),
    });
  } catch (error) {
    console.error('Error generating compliance overview (super admin):', error);
    res.status(500).json({ error: 'Failed to generate compliance overview' });
  }
});

router.get('/features', async (req, res) => {
  try {
    const features = await prisma.feature.findMany({
      include: {
        _count: {
          select: { tenantFeatures: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      total: features.length,
      features,
    });
  } catch (error) {
    console.error('Error listing features (super admin):', error);
    res.status(500).json({ error: 'Failed to list features' });
  }
});

router.post('/features', async (req, res) => {
  try {
    const { name, description = null, isGlobal = false, defaultStatus = 'DISABLED' } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Feature name is required' });
    }

    const allowed = ['ENABLED', 'DISABLED', 'BETA', 'DEPRECATED'];
    if (!allowed.includes(defaultStatus)) {
      return res.status(400).json({ error: `defaultStatus must be one of: ${allowed.join(', ')}` });
    }

    const feature = await prisma.feature.create({
      data: {
        name: String(name).trim(),
        description,
        isGlobal: Boolean(isGlobal),
        defaultStatus,
      },
    });

    await logPlatformAudit({
      tenantId: null,
      actorUserId: req.user?.id ?? null,
      action: 'FEATURE_CREATED',
      entityType: 'FEATURE',
      entityId: String(feature.id),
      newValue: feature,
      metadata: { actorEmail: req.user?.email || null },
    });

    res.status(201).json({ feature });
  } catch (error) {
    console.error('Error creating feature (super admin):', error);
    res.status(500).json({ error: 'Failed to create feature' });
  }
});

router.patch('/features/:featureId', async (req, res) => {
  try {
    const featureId = parseInt(req.params.featureId, 10);
    if (!featureId) return res.status(400).json({ error: 'Invalid featureId' });

    const { description, isGlobal, defaultStatus } = req.body || {};
    const allowed = ['ENABLED', 'DISABLED', 'BETA', 'DEPRECATED'];
    if (defaultStatus && !allowed.includes(defaultStatus)) {
      return res.status(400).json({ error: `defaultStatus must be one of: ${allowed.join(', ')}` });
    }

    const previous = await prisma.feature.findUnique({ where: { id: featureId } });
    if (!previous) return res.status(404).json({ error: 'Feature not found' });

    const feature = await prisma.feature.update({
      where: { id: featureId },
      data: {
        ...(description !== undefined ? { description } : {}),
        ...(isGlobal !== undefined ? { isGlobal: Boolean(isGlobal) } : {}),
        ...(defaultStatus ? { defaultStatus } : {}),
      },
    });

    await logPlatformAudit({
      tenantId: null,
      actorUserId: req.user?.id ?? null,
      action: 'FEATURE_UPDATED',
      entityType: 'FEATURE',
      entityId: String(featureId),
      oldValue: previous,
      newValue: feature,
      metadata: { actorEmail: req.user?.email || null },
    });

    res.json({ feature });
  } catch (error) {
    console.error('Error updating feature (super admin):', error);
    res.status(500).json({ error: 'Failed to update feature' });
  }
});

router.get('/tenants/:tenantId/features', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid tenantId' });

    const [features, tenantFeatureRows] = await Promise.all([
      prisma.feature.findMany({ orderBy: { name: 'asc' } }),
      prisma.tenantFeature.findMany({ where: { tenantId } }),
    ]);

    const stateByFeatureId = new Map(tenantFeatureRows.map((row) => [row.featureId, row]));
    const effective = features.map((f) => {
      const row = stateByFeatureId.get(f.id);
      return {
        featureId: f.id,
        name: f.name,
        description: f.description,
        isGlobal: f.isGlobal,
        defaultStatus: f.defaultStatus,
        tenantStatus: row?.status || null,
        effectiveStatus: row?.status || f.defaultStatus,
      };
    });

    res.json({ tenantId, total: effective.length, features: effective });
  } catch (error) {
    console.error('Error listing tenant feature toggles (super admin):', error);
    res.status(500).json({ error: 'Failed to list tenant feature toggles' });
  }
});

router.patch('/tenants/:tenantId/features/:featureId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    const featureId = parseInt(req.params.featureId, 10);
    const { status } = req.body || {};
    const allowed = ['ENABLED', 'DISABLED', 'BETA', 'DEPRECATED'];

    if (!tenantId || !featureId) return res.status(400).json({ error: 'Invalid tenantId or featureId' });
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const existing = await prisma.tenantFeature.findUnique({
      where: { tenantId_featureId: { tenantId, featureId } },
    });

    const updated = await prisma.tenantFeature.upsert({
      where: { tenantId_featureId: { tenantId, featureId } },
      update: { status },
      create: { tenantId, featureId, status },
    });

    await logPlatformAudit({
      tenantId,
      actorUserId: req.user?.id ?? null,
      action: 'TENANT_FEATURE_UPDATED',
      entityType: 'TENANT_FEATURE',
      entityId: `${tenantId}:${featureId}`,
      oldValue: existing || null,
      newValue: updated,
      metadata: { actorEmail: req.user?.email || null },
    });

    res.json({ tenantFeature: updated });
  } catch (error) {
    console.error('Error updating tenant feature toggle (super admin):', error);
    res.status(500).json({ error: 'Failed to update tenant feature toggle' });
  }
});

router.get('/kyc/documents', async (req, res) => {
  try {
    const { status, tenantId, limit = 50, offset = 0 } = req.query;
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = parseInt(offset, 10) || 0;

    const where = {
      ...(status ? { status: String(status) } : {}),
      ...(tenantId ? { tenantId: parseInt(String(tenantId), 10) } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.kycDocument.count({ where }),
      prisma.kycDocument.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          reviewedBy: { select: { id: true, email: true, name: true } },
        },
        orderBy: { uploadDate: 'desc' },
        skip,
        take,
      }),
    ]);

    res.json({ total, limit: take, offset: skip, documents: rows });
  } catch (error) {
    console.error('Error listing KYC documents (super admin):', error);
    res.status(500).json({ error: 'Failed to list KYC documents' });
  }
});

router.patch('/kyc/documents/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid KYC document id' });

    const { status, notes = null } = req.body || {};
    const allowed = ['PENDING', 'APPROVED', 'REJECTED', 'UNDER_REVIEW'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const previous = await prisma.kycDocument.findUnique({ where: { id } });
    if (!previous) return res.status(404).json({ error: 'KYC document not found' });

    const updated = await prisma.kycDocument.update({
      where: { id },
      data: {
        status,
        notes,
        reviewedById: req.user?.id ?? null,
        reviewDate: new Date(),
      },
    });

    await logPlatformAudit({
      tenantId: updated.tenantId,
      actorUserId: req.user?.id ?? null,
      action: 'KYC_DOCUMENT_STATUS_UPDATED',
      entityType: 'KYC_DOCUMENT',
      entityId: String(id),
      oldValue: { status: previous.status, notes: previous.notes },
      newValue: { status: updated.status, notes: updated.notes },
      metadata: { actorEmail: req.user?.email || null },
    });

    res.json({ document: updated });
  } catch (error) {
    console.error('Error updating KYC document status (super admin):', error);
    res.status(500).json({ error: 'Failed to update KYC document status' });
  }
});

router.get('/usage/metrics', async (req, res) => {
  try {
    const { metricType, tenantId, startDate, endDate, limit = 200 } = req.query;
    const take = Math.min(parseInt(limit, 10) || 200, 1000);

    const where = {
      ...(metricType ? { metricType: String(metricType) } : {}),
      ...(tenantId ? { tenantId: parseInt(String(tenantId), 10) } : {}),
      ...(startDate || endDate
        ? {
            timestamp: {
              ...(startDate ? { gte: new Date(String(startDate)) } : {}),
              ...(endDate ? { lte: new Date(String(endDate)) } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.usageMetric.count({ where }),
      prisma.usageMetric.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { timestamp: 'desc' },
        take,
      }),
    ]);

    res.json({
      total,
      limit: take,
      metrics: rows.map((row) => ({
        ...row,
        value: row.value?.toString?.() ?? String(row.value),
      })),
    });
  } catch (error) {
    console.error('Error listing usage metrics (super admin):', error);
    res.status(500).json({ error: 'Failed to list usage metrics' });
  }
});

router.post('/usage/metrics', async (req, res) => {
  try {
    const { tenantId = null, metricType, value, timestamp = null, metadata = null } = req.body || {};
    if (!metricType || typeof metricType !== 'string') {
      return res.status(400).json({ error: 'metricType is required' });
    }

    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'value is required' });
    }

    const metric = await prisma.usageMetric.create({
      data: {
        tenantId: tenantId ? parseInt(String(tenantId), 10) : null,
        metricType,
        value: BigInt(value),
        timestamp: timestamp ? new Date(String(timestamp)) : new Date(),
        metadata,
      },
    });

    res.status(201).json({
      metric: {
        ...metric,
        value: metric.value?.toString?.() ?? String(metric.value),
      },
    });
  } catch (error) {
    console.error('Error creating usage metric (super admin):', error);
    res.status(500).json({ error: 'Failed to create usage metric' });
  }
});

router.get('/audits/logins', async (req, res) => {
  try {
    const { successful, userId, startDate, endDate, limit = 100, offset = 0 } = req.query;
    const take = Math.min(parseInt(limit, 10) || 100, 500);
    const skip = parseInt(offset, 10) || 0;

    const where = {
      ...(successful !== undefined ? { successful: String(successful) === 'true' } : {}),
      ...(userId ? { userId: parseInt(String(userId), 10) } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(String(startDate)) } : {}),
              ...(endDate ? { lte: new Date(String(endDate)) } : {}),
            },
          }
        : {}),
    };

    const [total, audits] = await Promise.all([
      prisma.loginAudit.count({ where }),
      prisma.loginAudit.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              tenantId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    res.json({ total, limit: take, offset: skip, audits });
  } catch (error) {
    console.error('Error listing login audits (super admin):', error);
    res.status(500).json({ error: 'Failed to list login audits' });
  }
});

router.get('/audits/activity', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    const [journals, stockMovements, bankTransactions, platformAudits] = await Promise.all([
      prisma.journal.findMany({
        select: {
          id: true,
          tenantId: true,
          date: true,
          description: true,
          reference: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.stockMovement.findMany({
        select: {
          id: true,
          tenantId: true,
          type: true,
          reason: true,
          quantity: true,
          reference: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.bankTransaction.findMany({
        select: {
          id: true,
          tenantId: true,
          type: true,
          amount: true,
          reference: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.platformAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const normalized = [
      ...journals.map((j) => ({
        source: 'JOURNAL',
        id: j.id,
        tenantId: j.tenantId,
        timestamp: j.createdAt,
        summary: j.description,
        reference: j.reference,
        payload: j,
      })),
      ...stockMovements.map((s) => ({
        source: 'STOCK_MOVEMENT',
        id: s.id,
        tenantId: s.tenantId,
        timestamp: s.createdAt,
        summary: `${s.type}${s.reason ? ` / ${s.reason}` : ''}`,
        reference: s.reference,
        payload: s,
      })),
      ...bankTransactions.map((b) => ({
        source: 'BANK_TRANSACTION',
        id: b.id,
        tenantId: b.tenantId,
        timestamp: b.createdAt,
        summary: `${b.type} ${Number(b.amount)}`,
        reference: b.reference,
        payload: b,
      })),
      ...platformAudits.map((a) => ({
        source: 'PLATFORM_AUDIT',
        id: a.id,
        tenantId: a.tenantId,
        timestamp: a.createdAt,
        summary: a.action,
        reference: a.entityId,
        payload: a,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    res.json({
      total: normalized.length,
      items: normalized,
    });
  } catch (error) {
    console.error('Error fetching audit activity (super admin):', error);
    res.status(500).json({ error: 'Failed to fetch audit activity' });
  }
});

export default router;
