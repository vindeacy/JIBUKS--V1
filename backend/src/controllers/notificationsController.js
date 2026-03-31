import { prisma } from '../lib/prisma.js';

const ALLOWED_SEVERITIES = new Set(['INFO', 'WARNING', 'CRITICAL']);
const ALLOWED_TYPES = new Set(['BILLING', 'COMPLIANCE', 'SECURITY', 'SYSTEM']);

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}

function parseLimit(value, fallback = 25) {
  const parsed = parseInt(String(value ?? fallback), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(100, Math.max(1, parsed));
}

function formatAmount(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '0';
  return amount.toLocaleString();
}

function safeTenantMetadata(tenant) {
  return tenant?.metadata && typeof tenant.metadata === 'object' ? tenant.metadata : {};
}

async function buildNotifications() {
  const now = new Date();

  const [
    overdueInvoices,
    overduePurchases,
    suspendedTenants,
    reviewTenants,
    securityAudits,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        dueDate: { lt: now },
        status: { in: ['OVERDUE', 'UNPAID', 'PARTIAL'] },
      },
      orderBy: { dueDate: 'asc' },
      take: 30,
      select: {
        id: true,
        tenantId: true,
        dueDate: true,
        total: true,
        updatedAt: true,
        tenant: { select: { name: true } },
      },
    }),
    prisma.purchase.findMany({
      where: {
        dueDate: { lt: now },
        status: { in: ['UNPAID', 'PARTIAL'] },
      },
      orderBy: { dueDate: 'asc' },
      take: 30,
      select: {
        id: true,
        tenantId: true,
        dueDate: true,
        total: true,
        updatedAt: true,
        tenant: { select: { name: true } },
        vendor: { select: { name: true } },
      },
    }),
    prisma.tenant.findMany({
      where: {
        metadata: {
          path: ['platformStatus'],
          equals: 'SUSPENDED',
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, name: true, updatedAt: true, metadata: true },
    }),
    prisma.tenant.findMany({
      where: {
        metadata: {
          path: ['platformStatus'],
          equals: 'UNDER_REVIEW',
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, name: true, updatedAt: true, metadata: true },
    }),
    prisma.platformAuditLog.findMany({
      where: {
        OR: [
          { action: { contains: 'FAILED', mode: 'insensitive' } },
          { action: { contains: 'UNAUTHORIZED', mode: 'insensitive' } },
          { action: { contains: 'LOCKED', mode: 'insensitive' } },
          { action: { contains: 'SUSPEND', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        tenantId: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
    }),
  ]);

  const invoiceNotifications = overdueInvoices.map((row) => ({
    id: `invoice-overdue-${row.id}`,
    type: 'BILLING',
    severity: 'CRITICAL',
    title: 'Overdue customer invoice',
    message: `${row.tenant?.name || 'Tenant'} has overdue invoice total ${formatAmount(row.total)} KES`,
    createdAt: row.updatedAt,
    tenantId: String(row.tenantId),
    tenantName: row.tenant?.name || null,
    actionUrl: '/tenants',
  }));

  const purchaseNotifications = overduePurchases.map((row) => ({
    id: `purchase-overdue-${row.id}`,
    type: 'BILLING',
    severity: 'WARNING',
    title: 'Overdue supplier bill',
    message: `${row.tenant?.name || 'Tenant'} has overdue bill ${formatAmount(row.total)} KES${row.vendor?.name ? ` (${row.vendor.name})` : ''}`,
    createdAt: row.updatedAt,
    tenantId: String(row.tenantId),
    tenantName: row.tenant?.name || null,
    actionUrl: '/tenants',
  }));

  const suspendedNotifications = suspendedTenants.map((tenant) => {
    const metadata = safeTenantMetadata(tenant);
    return {
      id: `tenant-suspended-${tenant.id}`,
      type: 'COMPLIANCE',
      severity: 'CRITICAL',
      title: 'Tenant suspended',
      message: `${tenant.name} is currently suspended${metadata.platformStatusNote ? ` (${metadata.platformStatusNote})` : ''}`,
      createdAt: tenant.updatedAt,
      tenantId: String(tenant.id),
      tenantName: tenant.name,
      actionUrl: `/tenants/${tenant.id}`,
    };
  });

  const reviewNotifications = reviewTenants.map((tenant) => ({
    id: `tenant-review-${tenant.id}`,
    type: 'COMPLIANCE',
    severity: 'INFO',
    title: 'Tenant under review',
    message: `${tenant.name} is marked UNDER_REVIEW and may require governance action`,
    createdAt: tenant.updatedAt,
    tenantId: String(tenant.id),
    tenantName: tenant.name,
    actionUrl: `/tenants/${tenant.id}`,
  }));

  const auditNotifications = securityAudits.map((log) => ({
    id: `audit-${log.id}`,
    type: 'SECURITY',
    severity: 'WARNING',
    title: 'Platform security/governance event',
    message: `${log.action}${log.entityType ? ` (${log.entityType})` : ''}`,
    createdAt: log.createdAt,
    tenantId: log.tenantId ? String(log.tenantId) : null,
    tenantName: null,
    actionUrl: '/audits',
  }));

  const aggregated = [
    ...invoiceNotifications,
    ...purchaseNotifications,
    ...suspendedNotifications,
    ...reviewNotifications,
    ...auditNotifications,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (aggregated.length === 0) {
    return [
      {
        id: 'system-bootstrap-notification',
        type: 'SYSTEM',
        severity: 'INFO',
        title: 'Notifications are active',
        message: 'No billing, compliance, or security alerts right now.',
        createdAt: new Date(),
        tenantId: null,
        tenantName: null,
        actionUrl: '/dashboard',
      },
    ];
  }

  return aggregated;
}

export async function listNotifications(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const severity = req.query?.severity ? String(req.query.severity) : undefined;
    const type = req.query?.type ? String(req.query.type) : undefined;

    if (severity && !ALLOWED_SEVERITIES.has(severity)) {
      return res.status(400).json({ success: false, message: 'Invalid severity filter' });
    }

    if (type && !ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ success: false, message: 'Invalid type filter' });
    }

    const limit = parseLimit(req.query?.limit, 25);
    const unreadOnly = toBool(req.query?.unreadOnly, false);
    const includeDismissed = toBool(req.query?.includeDismissed, false);

    const notifications = await buildNotifications();
    const filtered = notifications
      .filter((item) => (severity ? item.severity === severity : true))
      .filter((item) => (type ? item.type === type : true));

    const keys = filtered.map((item) => item.id);
    const states = keys.length
      ? await prisma.notificationState.findMany({
          where: {
            userId: req.user.id,
            notificationKey: { in: keys },
          },
          select: {
            notificationKey: true,
            isRead: true,
            readAt: true,
            isDismissed: true,
            dismissedAt: true,
          },
        })
      : [];

    const stateByKey = new Map(states.map((state) => [state.notificationKey, state]));

    const visible = filtered
      .map((item) => {
        const state = stateByKey.get(item.id);
        return {
          ...item,
          isRead: state?.isRead ?? false,
          readAt: state?.readAt ?? null,
          isDismissed: state?.isDismissed ?? false,
          dismissedAt: state?.dismissedAt ?? null,
        };
      })
      .filter((item) => (includeDismissed ? true : !item.isDismissed))
      .filter((item) => (unreadOnly ? !item.isRead : true));

    const paged = visible.slice(0, limit);

    const summary = {
      total: visible.length,
      unread: visible.filter((n) => !n.isRead).length,
      unresolved: visible.filter((n) => n.severity !== 'INFO').length,
      critical: visible.filter((n) => n.severity === 'CRITICAL').length,
      generatedAt: new Date().toISOString(),
    };

    return res.status(200).json({
      success: true,
      data: paged.map((n) => ({
        ...n,
        createdAt: new Date(n.createdAt).toISOString(),
        readAt: n.readAt ? new Date(n.readAt).toISOString() : null,
        dismissedAt: n.dismissedAt ? new Date(n.dismissedAt).toISOString() : null,
      })),
      summary,
    });
  } catch (error) {
    console.error('List notifications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
}

export async function markNotificationRead(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const notificationId = String(req.params.notificationId || '').trim();
    if (!notificationId) {
      return res.status(400).json({ success: false, message: 'Invalid notification id' });
    }

    await prisma.notificationState.upsert({
      where: {
        userId_notificationKey: {
          userId: req.user.id,
          notificationKey: notificationId,
        },
      },
      update: {
        isRead: true,
        readAt: new Date(),
      },
      create: {
        userId: req.user.id,
        notificationKey: notificationId,
        isRead: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
}

export async function dismissNotification(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const notificationId = String(req.params.notificationId || '').trim();
    if (!notificationId) {
      return res.status(400).json({ success: false, message: 'Invalid notification id' });
    }

    const now = new Date();

    await prisma.notificationState.upsert({
      where: {
        userId_notificationKey: {
          userId: req.user.id,
          notificationKey: notificationId,
        },
      },
      update: {
        isRead: true,
        readAt: now,
        isDismissed: true,
        dismissedAt: now,
      },
      create: {
        userId: req.user.id,
        notificationKey: notificationId,
        isRead: true,
        readAt: now,
        isDismissed: true,
        dismissedAt: now,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Notification dismissed',
    });
  } catch (error) {
    console.error('Dismiss notification error:', error);
    return res.status(500).json({ success: false, message: 'Failed to dismiss notification' });
  }
}

export async function markAllNotificationsRead(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const notifications = await buildNotifications();
    const now = new Date();

    await Promise.all(
      notifications.map((n) =>
        prisma.notificationState.upsert({
          where: {
            userId_notificationKey: {
              userId: req.user.id,
              notificationKey: n.id,
            },
          },
          update: {
            isRead: true,
            readAt: now,
          },
          create: {
            userId: req.user.id,
            notificationKey: n.id,
            isRead: true,
            readAt: now,
          },
        })
      )
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: { updated: notifications.length },
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark all notifications as read' });
  }
}
