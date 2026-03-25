# Super Admin Integration (Multi-Tenant)

This backend now exposes a dedicated super-admin API namespace:

- `GET /api/super-admin/tenants`
- `GET /api/super-admin/tenants/:tenantId`
- `GET /api/super-admin/tenants/:tenantId/users`
- `PATCH /api/super-admin/tenants/:tenantId/users/:userId/status`
- `PATCH /api/super-admin/tenants/:tenantId/status`
- `GET /api/super-admin/tenants/:tenantId/metrics`
- `GET /api/super-admin/tenants/:tenantId/compliance`
- `GET /api/super-admin/tenants/:tenantId/audits/activity`
- `GET /api/super-admin/analytics/overview`
- `GET /api/super-admin/compliance/overview`
- `GET /api/super-admin/audits/activity`

## Access Model

All super-admin routes require:

1. Valid JWT (`Authorization: Bearer <token>`)
2. Super-admin authorization (`requireSuperAdmin`)

Super-admin is granted by any of the following:

- Email appears in `SUPER_ADMIN_EMAILS` env var (comma-separated)
- User role is `ADMIN` and user has no tenant (`tenantId = null`)
- User JSON `permissions` contains `superAdmin: true` or `canManageTenants: true`

## Tenant Governance

Tenant status is persisted in `Tenant.metadata.platformStatus`:

- `ACTIVE`
- `SUSPENDED`
- `UNDER_REVIEW`

When tenant status is `SUSPENDED`, standard tenant users are blocked at auth middleware level for protected routes.

## Multi-Tenancy Notes

- Tenant-specific API endpoints derive tenant from JWT claim (not request payload/query).
- Super-admin endpoints accept tenant IDs intentionally and always scope data by tenant in queries.
- Legacy insecure patterns (passing tenantId in query/body for protected operations) should be avoided.

## Frontend (jibuks-super-admin)

Your super-admin frontend should call this backend directly, using a dedicated API client and the same domain base URL.

Recommended env:

- `SUPER_ADMIN_API_URL=https://<backend-domain>/api`
- `SUPER_ADMIN_EMAILS=admin1@domain.com,admin2@domain.com`
