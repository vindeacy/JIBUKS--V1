# JIBUKS Backend - Complete API Endpoints Reference

**Backend URL**: `http://localhost:4001`  
**API Base**: `http://localhost:4001/api`  
**Database**: APP (PostgreSQL)

---

## 📋 Authentication Routes (`/api/auth`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/register` | ❌ | Register new user |
| POST | `/api/auth/login` | ❌ | Login with email/password |
| POST | `/api/auth/refresh-token` | ❌ | Refresh access token |
| POST | `/api/auth/logout` | ❌ | Logout user |
| POST | `/api/auth/forgot-password` | ❌ | Request password reset |
| POST | `/api/auth/verify-otp` | ❌ | Verify OTP code |
| POST | `/api/auth/reset-password` | ❌ | Reset password with token |
| GET | `/api/auth/me` | ✅ JWT | Get current user profile (includes `isSuperAdmin` flag) |

---

## 👥 User Management (`/api/users`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/users` | ✅ JWT | List users in tenant |
| GET | `/api/users/all` | ✅ Super-Admin | List ALL users (platform-wide) |
| POST | `/api/users` | ✅ JWT | Create new user |

---

## 🏢 Business Routes (`/api/business`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/business/profile` | ✅ JWT | Get tenant business profile |
| PUT | `/api/business/profile` | ✅ JWT | Update business profile |
| GET | `/api/business/onboarding-status` | ✅ JWT | Get onboarding status |
| PUT | `/api/business/onboarding` | ✅ JWT | Complete onboarding |
| PUT | `/api/business/contact` | ✅ JWT | Update contact info |
| PUT | `/api/business/tax-settings` | ✅ JWT | Update tax settings |
| GET | `/api/business/staff` | ✅ JWT | List business staff |
| POST | `/api/business/staff` | ✅ JWT | Add staff member |

---

## 📊 Dashboard Routes

### Business Dashboard (`/api/dashboard`)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/dashboard/business` | ✅ JWT | Get dashboard data for tenant |

### Family Dashboard (`/api/family`)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/family/dashboard` | ✅ JWT | Get family dashboard stats |

---

## 👨‍👩‍👧‍👦 Family Management (`/api/family`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/family` | ✅ JWT | Get family info |
| PUT | `/api/family` | ✅ JWT | Update family |
| POST | `/api/family/members` | ✅ JWT | Add family member |
| GET | `/api/family/settings` | ✅ JWT | Get family settings |
| PUT | `/api/family/profile` | ✅ JWT | Update family profile |
| GET | `/api/family/members/:memberId` | ✅ JWT | Get member details |
| PUT | `/api/family/members/:memberId/permissions` | ✅ JWT | Update member permissions |
| PUT | `/api/family/members/:memberId/role` | ✅ JWT | Update member role |
| DELETE | `/api/family/members/:memberId` | ✅ JWT | Remove member |
| DELETE | `/api/family/leave` | ✅ JWT | Leave family |
| DELETE | `/api/family` | ✅ JWT | Delete family |

### Family Goals
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/family/goals` | ✅ JWT | Create family goal |
| GET | `/api/family/goals` | ✅ JWT | List family goals |

### Family Budgets
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/family/budgets` | ✅ JWT | Create budget |
| GET | `/api/family/budgets` | ✅ JWT | List budgets |

---

## 📈 Goals Management (`/api/goals`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/goals` | ✅ JWT | List all goals |
| GET | `/api/goals/:id` | ✅ JWT | Get goal details |
| POST | `/api/goals` | ✅ JWT | Create new goal |
| POST | `/api/goals/:id/contribute` | ✅ JWT | Add contribution to goal |
| PUT | `/api/goals/:id` | ✅ JWT | Update goal |
| DELETE | `/api/goals/:id` | ✅ JWT | Delete goal |

---

## 💼 Chart of Accounts (`/api/accounts`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/accounts` | ✅ JWT | List all accounts (with optional balances) |
| GET | `/api/accounts/payment-eligible` | ✅ JWT | Get payment-eligible accounts (Cash/Bank) |
| GET | `/api/accounts/types` | ✅ JWT | Get account type definitions |
| GET | `/api/accounts/mapping` | ✅ JWT | Get category-to-account mapping |
| GET | `/api/accounts/balances/summary` | ✅ JWT | Get account balances summary |
| GET | `/api/accounts/:id` | ✅ JWT | Get account details |
| POST | `/api/accounts` | ✅ JWT | Create new account |
| PUT | `/api/accounts/:id` | ✅ JWT | Update account |
| DELETE | `/api/accounts/:id` | ✅ JWT | Delete account (non-system only) |
| POST | `/api/accounts/seed` | ✅ JWT | Seed default Chart of Accounts |

---

## 💰 Transactions (`/api/transactions`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/transactions` | ✅ JWT | List transactions (paginated, filtered) |
| GET | `/api/transactions/stats` | ✅ JWT | Get transaction statistics |
| POST | `/api/transactions` | ✅ JWT | Create transaction |
| GET | `/api/transactions/:id` | ✅ JWT | Get transaction details |
| PUT | `/api/transactions/:id` | ✅ JWT | Update transaction |
| DELETE | `/api/transactions/:id` | ✅ JWT | Delete transaction |

---

## 📂 Categories (`/api/categories`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/categories` | ✅ JWT | List categories |
| POST | `/api/categories` | ✅ JWT | Create category |
| PUT | `/api/categories/:id` | ✅ JWT | Update category |
| DELETE | `/api/categories/:id` | ✅ JWT | Delete category |
| POST | `/api/categories/seed` | ✅ JWT | Seed default categories |

---

## 💳 Payment Methods (`/api/payment-methods`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/payment-methods` | ✅ JWT | List payment methods |
| POST | `/api/payment-methods` | ✅ JWT | Create payment method |
| PUT | `/api/payment-methods/:id` | ✅ JWT | Update payment method |
| DELETE | `/api/payment-methods/:id` | ✅ JWT | Delete payment method |
| POST | `/api/payment-methods/seed` | ✅ JWT | Seed default payment methods |

---

## 🏦 Bank Management (`/api/bank`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/bank/transactions` | ✅ JWT | List bank transactions |
| GET | `/api/bank/unreconciled` | ✅ JWT | Get unreconciled transactions |
| GET | `/api/bank/statement` | ✅ JWT | Get bank statement |
| POST | `/api/bank/deposit` | ✅ JWT | Record bank deposit |
| POST | `/api/bank/cheque` | ✅ JWT | Record cheque transaction |
| POST | `/api/bank/transfer` | ✅ JWT | Record bank transfer |
| PUT | `/api/bank/reconcile/:id` | ✅ JWT | Reconcile transaction |
| PUT | `/api/bank/status/:id` | ✅ JWT | Update transaction status |

---

## ✅ Cheques (`/api/cheques`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/cheques/pending` | ✅ JWT | List pending cheques |
| GET | `/api/cheques/all` | ✅ JWT | List all cheques |
| GET | `/api/cheques/summary` | ✅ JWT | Get cheque summary |
| GET | `/api/cheques/:id` | ✅ JWT | Get cheque details |
| POST | `/api/cheques/create` | ✅ JWT | Create cheque |
| POST | `/api/cheques/:id/clear` | ✅ JWT | Clear cheque |
| POST | `/api/cheques/:id/void` | ✅ JWT | Void cheque |

---

## 📦 Inventory (`/api/inventory`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/inventory/item-types` | ✅ JWT | Get item types |
| GET | `/api/inventory` | ✅ JWT | List inventory items |
| GET | `/api/inventory/products` | ✅ JWT | List products |
| GET | `/api/inventory/products/:id` | ✅ JWT | Get product details |
| GET | `/api/inventory/alerts` | ✅ JWT | Get low-stock alerts |
| GET | `/api/inventory/transactions` | ✅ JWT | Get stock movements |
| GET | `/api/inventory/valuation/current` | ✅ JWT | Get current valuation |
| GET | `/api/inventory/accounting/valuation` | ✅ JWT | Get accounting valuation |
| GET | `/api/inventory/:itemId/history` | ✅ JWT | Get item history |
| GET | `/api/inventory/cogs-report` | ✅ JWT | Get COGS report |
| GET | `/api/inventory/catalog` | ✅ JWT | Get product catalog |
| POST | `/api/inventory/products` | ✅ JWT | Create product |
| POST | `/api/inventory/adjust` | ✅ JWT | Adjust stock |
| POST | `/api/inventory/credit-memo` | ✅ JWT | Create credit memo |
| POST | `/api/inventory/physical-count` | ✅ JWT | Record physical count |

---

## 👥 Vendors (`/api/vendors`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/vendors` | ✅ JWT | List vendors |
| GET | `/api/vendors/:id` | ✅ JWT | Get vendor details |
| GET | `/api/vendors/:id/statement` | ✅ JWT | Get vendor statement |
| POST | `/api/vendors` | ✅ JWT | Create vendor |
| PUT | `/api/vendors/:id` | ✅ JWT | Update vendor |
| DELETE | `/api/vendors/:id` | ✅ JWT | Delete vendor |

---

## 🛒 Purchases (`/api/purchases`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/purchases` | ✅ JWT | List purchases/bills |
| GET | `/api/purchases/:id` | ✅ JWT | Get purchase details |
| GET | `/api/purchases/status/unpaid` | ✅ JWT | Get unpaid bills |
| POST | `/api/purchases` | ✅ JWT | Create purchase |
| PUT | `/api/purchases/:id` | ✅ JWT | Update purchase |
| DELETE | `/api/purchases/:id` | ✅ JWT | Delete purchase |
| POST | `/api/purchases/:id/payment` | ✅ JWT | Record payment against bill |

---

## 👤 Customers (`/api/customers`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/customers` | ✅ JWT | List customers |
| GET | `/api/customers/:id` | ✅ JWT | Get customer details |
| GET | `/api/customers/:id/statement` | ✅ JWT | Get customer statement |
| GET | `/api/customers/:id/balance` | ✅ JWT | Get customer balance |
| GET | `/api/customers/:id/transactions` | ✅ JWT | Get customer transactions |
| GET | `/api/customers/:id/analytics` | ✅ JWT | Get customer analytics |
| POST | `/api/customers` | ✅ JWT | Create customer |
| PUT | `/api/customers/:id` | ✅ JWT | Update customer |
| DELETE | `/api/customers/:id` | ✅ JWT | Delete customer |

---

## 🧾 Invoices (`/api/invoices`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/invoices` | ✅ JWT | List invoices |
| GET | `/api/invoices/:id` | ✅ JWT | Get invoice details |
| GET | `/api/invoices/status/unpaid` | ✅ JWT | Get unpaid invoices |
| POST | `/api/invoices` | ✅ JWT | Create invoice |
| PUT | `/api/invoices/:id` | ✅ JWT | Update invoice |
| DELETE | `/api/invoices/:id` | ✅ JWT | Delete invoice |
| POST | `/api/invoices/:id/payment` | ✅ JWT | Record payment against invoice |

---

## 💸 Transfers (`/api/transfers`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/transfers` | ✅ JWT | List transfers |
| GET | `/api/transfers/:id` | ✅ JWT | Get transfer details |
| POST | `/api/transfers` | ✅ JWT | Create transfer between accounts |

---

## 🏠 Fixed Assets (`/api/fixed-assets`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/fixed-assets` | ✅ JWT | List fixed assets |
| GET | `/api/fixed-assets/:id` | ✅ JWT | Get asset details |
| GET | `/api/fixed-assets/accounts` | ✅ JWT | Get asset accounts |
| POST | `/api/fixed-assets` | ✅ JWT | Create asset |
| POST | `/api/fixed-assets/:id/depreciate` | ✅ JWT | Record depreciation |
| POST | `/api/fixed-assets/:id/dispose` | ✅ JWT | Dispose of asset |

---

## 💳 Lending (`/api/lending`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/lending/dashboard` | ✅ JWT | Get lending dashboard |
| POST | `/api/lending/issue` | ✅ JWT | Issue a loan |
| POST | `/api/lending/repay` | ✅ JWT | Record loan repayment |
| POST | `/api/lending/:id/write-off` | ✅ JWT | Write off loan |

---

## 🧾 Reporting (`/api/reports`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/reports/trial-balance` | ✅ JWT | Get trial balance report |
| GET | `/api/reports/profit-loss` | ✅ JWT | Get P&L statement |
| GET | `/api/reports/cash-flow` | ✅ JWT | Get cash flow statement |
| GET | `/api/reports/balance-sheet` | ✅ JWT | Get balance sheet |
| GET | `/api/reports/summary` | ✅ JWT | Get financial summary |
| GET | `/api/reports/monthly-trend` | ✅ JWT | Get monthly trends |
| GET | `/api/reports/category-analysis` | ✅ JWT | Get category analysis |
| GET | `/api/reports/account-transactions/:accountId` | ✅ JWT | Get account transaction details |

---

## 💰 VAT Rates (`/api/vat-rates`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/vat-rates` | ✅ JWT | List VAT rates |
| GET | `/api/vat-rates/:id` | ✅ JWT | Get VAT rate details |
| POST | `/api/vat-rates` | ✅ JWT | Create VAT rate |
| PUT | `/api/vat-rates/:id` | ✅ JWT | Update VAT rate |
| DELETE | `/api/vat-rates/:id` | ✅ JWT | Delete VAT rate |

---

## 🛡️ Super Admin Routes (`/api/super-admin`)

**All require**: `✅ JWT` + `requireSuperAdmin` middleware

### Profile & Dashboard
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/super-admin/me` | Get super-admin profile + scopes |
| GET | `/api/super-admin/dashboard` | Get platform dashboard (KPIs) |

### Tenant Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/super-admin/tenants` | List all tenants (paginated, searchable) |
| GET | `/api/super-admin/tenants/:tenantId` | Get tenant details |
| GET | `/api/super-admin/tenants/:tenantId/users` | List tenant users |
| GET | `/api/super-admin/tenants/:tenantId/metrics` | Get tenant metrics (invoices, purchases, users) |
| GET | `/api/super-admin/tenants/:tenantId/compliance` | Get tenant compliance score |
| GET | `/api/super-admin/tenants/:tenantId/audits/activity` | Get tenant audit trail |
| PATCH | `/api/super-admin/tenants/:tenantId/status` | Update tenant status (ACTIVE/SUSPENDED/UNDER_REVIEW) |
| PATCH | `/api/super-admin/tenants/:tenantId/users/:userId/status` | Enable/disable tenant user |

### Platform Analytics & Audits
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/super-admin/analytics/overview` | Get platform-wide analytics |
| GET | `/api/super-admin/compliance/overview` | Get compliance overview (all tenants) |
| GET | `/api/super-admin/audits/activity` | Get global audit activity feed |

### Billing Oversight
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/super-admin/billing/overview` | Platform-wide receivables/payables exposure, overdue and due-soon risk |
| GET | `/api/super-admin/tenants/:tenantId/billing` | Tenant billing summary + recent invoices and purchases |

### Feature Toggles
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/super-admin/features` | List platform features with tenant assignment counts |
| POST | `/api/super-admin/features` | Create a feature flag |
| PATCH | `/api/super-admin/features/:featureId` | Update feature metadata/default status |
| GET | `/api/super-admin/tenants/:tenantId/features` | List effective feature statuses for a tenant |
| PATCH | `/api/super-admin/tenants/:tenantId/features/:featureId` | Override a tenant feature status |

### KYC Workflow
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/super-admin/kyc/documents` | List KYC documents with status filters |
| PATCH | `/api/super-admin/kyc/documents/:id/status` | Approve/reject/mark-under-review KYC docs |

### Usage Metrics
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/super-admin/usage/metrics` | Query usage metrics by type/tenant/date |
| POST | `/api/super-admin/usage/metrics` | Ingest usage metric event |

### Login Audits
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/super-admin/audits/logins` | List successful/failed login attempts |

---

## 🔔 Notifications (`/api/notifications`)

**All require**: `✅ JWT` + `requireSuperAdmin` middleware

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/notifications` | List notifications with filters (`limit`, `severity`, `type`, `unreadOnly`, `includeDismissed`) |
| PATCH | `/api/notifications/read-all` | Mark all visible notifications as read |
| PATCH | `/api/notifications/:notificationId/read` | Mark a single notification as read |
| PATCH | `/api/notifications/:notificationId/dismiss` | Dismiss a single notification |

---

## 🔑 Authentication Model

### Login Response Includes:
```json
{
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "John",
    "role": "MEMBER|ADMIN",
    "tenantId": 1,
    "isSuperAdmin": false  // ← Added for super-admin detection
  }
}
```

### Super-Admin Access:
- Email in `SUPER_ADMIN_EMAILS` env var, OR
- User role=`ADMIN` with `tenantId=null`, OR
- User `permissions.superAdmin=true` or `permissions.canManageTenants=true`

---

## 🔐 Multi-Tenancy

- All tenant-scoped routes derive `tenantId` from JWT claim (`req.user.tenantId`)
- Super-admin routes accept `tenantId` intentionally for cross-tenant queries
- Suspended tenants (`metadata.platformStatus=SUSPENDED`) block non-super-admin access at auth middleware

---

## 📌 Query Parameters (Common)

- `limit` - Pagination limit (default: 50, max: 200)
- `offset` - Pagination offset (default: 0)
- `search` - Full-text search (where applicable)
- `startDate` / `endDate` - Date range filters (ISO format)
- `status` - Filter by status (varies per endpoint)
- `tenantType` - Filter by FAMILY/BUSINESS (super-admin only)

---

## 📌 Response Codes

- `200` - Success
- `201` - Created
- `400` - Bad request
- `401` - Unauthorized (missing/invalid JWT)
- `403` - Forbidden (not super-admin for protected routes)
- `404` - Not found
- `500` - Server error

---

## ✅ Usage for Super Admin Frontend

1. **Login**: `POST /api/auth/login`
2. **Check isSuperAdmin**: Look for `isSuperAdmin=true` in response
3. **Load Dashboard**: `GET /api/super-admin/dashboard`
4. **List Tenants**: `GET /api/super-admin/tenants?limit=50`
5. **Tenant Detail**: `GET /api/super-admin/tenants/{id}`
6. **Manage Status**: `PATCH /api/super-admin/tenants/{id}/status`
7. **Audit Trail**: `GET /api/super-admin/audits/activity`

