# JIBUKS Project Documentation (Backend + Frontend)

## 1) Project Context

**JIBUKS** is a full-stack financial management platform built for:
- **Families** (personal budgeting, income/expense tracking, shared goals)
- **Small/Medium Businesses** (accounting, inventory, invoicing, purchasing, banking, reports)

The system combines simple day-to-day finance tracking with **professional accounting workflows** (double-entry bookkeeping, chart of accounts, VAT, vendors/customers, fixed assets, lending, cheques, transfers).

---

## 2) High-Level Architecture

- **Frontend:** Expo + React Native app in [FRONTEND](FRONTEND)
- **Backend:** Node.js + Express API in [backend](backend)
- **Database:** PostgreSQL with Prisma schema/migrations in [backend/prisma](backend/prisma)
- **Deployment support:** Docker Compose in [docker-compose.yml](docker-compose.yml)

### Runtime model
1. Mobile/Web client authenticates via backend auth APIs.
2. Frontend stores JWT token in AsyncStorage and attaches it to requests.
3. Backend validates token, resolves tenant context, and executes domain logic.
4. Data is persisted to PostgreSQL through Prisma.

---

## 3) Repository Structure (Relevant)

- [README.md](README.md) – overall project readme
- [backend/src](backend/src) – API entrypoint, routes, controllers, middleware, services
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma) – core domain schema
- [backend/scripts](backend/scripts) – initialization and seeding scripts
- [FRONTEND/app](FRONTEND/app) – Expo Router screens and flow
- [FRONTEND/contexts](FRONTEND/contexts) – app state providers
- [FRONTEND/services/api.ts](FRONTEND/services/api.ts) – API client/service layer

---

## 4) Backend Documentation

## 4.1 Technology Stack

- Node.js + Express
- Prisma ORM + PostgreSQL
- JWT authentication
- Security middleware: Helmet, CORS, rate limiting
- Logging: Morgan
- File uploads: Multer

See dependencies in [backend/package.json](backend/package.json).

## 4.2 Backend Startup & Core Files

- App setup and route registration: [backend/src/app.js](backend/src/app.js)
- Server bootstrap / port / graceful shutdown: [backend/src/server.js](backend/src/server.js)
- Environment loader: [backend/src/env.js](backend/src/env.js)
- Prisma client init: [backend/src/lib/prisma.js](backend/src/lib/prisma.js)

## 4.3 API Design

The backend is organized by **domain-based route modules** mounted under `/api/*` in [backend/src/app.js](backend/src/app.js).

### Main API route groups
- `/api/auth` – login/register/token/OTP password reset
- `/api/users` – user management
- `/api/family` – family profile/settings/workflow
- `/api/transactions` – core transaction records
- `/api/categories` – income/expense categories
- `/api/payment-methods` – payment channels
- `/api/dashboard` – dashboard metrics
- `/api/goals` – goals and contributions
- `/api/accounts` – chart of accounts and account operations
- `/api/reports` – financial reports
- `/api/business` – business profile/operations
- `/api/vendors`, `/api/purchases`, `/api/inventory`
- `/api/bank`, `/api/fixed-assets`, `/api/customers`, `/api/invoices`
- `/api/cheques`, `/api/transfers`, `/api/lending`, `/api/vat-rates`
- `/api/super-admin`, `/api/notifications`

### Auth endpoints (examples)
Defined in [backend/src/routes/auth.js](backend/src/routes/auth.js):
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh-token`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-otp`
- `POST /api/auth/reset-password`
- `GET /api/auth/me` (protected)

## 4.4 Data Model (Prisma)

The schema in [backend/prisma/schema.prisma](backend/prisma/schema.prisma) is extensive and finance-focused.

### Core concepts
- **Tenant** model supports multi-tenant operation with `tenantType` (`FAMILY` or `BUSINESS`).
- **User** model supports roles and tenant scoping.
- **Account / Journal / JournalLine** provide double-entry bookkeeping structure.
- **Transaction** model links app-level records to accounting journals.

### Business/accounting entities (selected)
- Vendors, Purchases, Inventory Items, Stock Movements
- Customers, Invoices, Receipts
- Bank Transactions, Payment Accounts, Cheques, Transfers
- Loans and lending transactions
- VAT rates and tax-related structures
- Fixed assets and depreciation support

## 4.5 Security and Middleware

From [backend/src/app.js](backend/src/app.js):
- `helmet()` for security headers
- CORS with explicit local/prod origin handling
- JSON/body parsing limits
- request logging middleware
- static uploads serving under `/uploads`
- 404 + global error handler

## 4.6 Environment Configuration

Reference template: [backend/.env.example](backend/.env.example)

Key variables:
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `LOCAL_NETWORK_IP`
- SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `ADMIN_EMAIL`)
- optional Auth0 settings
- `SUPER_ADMIN_EMAILS` (used by runtime whitelist logic)

## 4.7 Backend Scripts

Defined in [backend/package.json](backend/package.json):
- `start`, `dev`
- `db:init`
- `seed` and domain seed scripts (`seed:assets`, `seed:liabilities`, etc.)
- `superadmin:grant`

Additional utilities live in [backend/scripts](backend/scripts).

---

## 5) Frontend Documentation

## 5.1 Technology Stack

- Expo SDK 54 + React Native 0.81
- Expo Router (file-based routing)
- React Context for auth and account state
- AsyncStorage for token persistence
- TypeScript

See dependencies in [FRONTEND/package.json](FRONTEND/package.json).

## 5.2 App Entry and Providers

- Root layout and navigation stack: [FRONTEND/app/_layout.tsx](FRONTEND/app/_layout.tsx)
- Auth provider: [FRONTEND/contexts/AuthContext.tsx](FRONTEND/contexts/AuthContext.tsx)

Provider responsibilities:
- Persisted auth bootstrapping on startup
- Login/register/logout state management
- User context shared across app

## 5.3 Navigation Structure

### Primary sections
- Auth/onboarding screens (login/signup/password reset/onboarding)
- Family setup & management screens
- Business onboarding and business dashboard flow
- Tabbed operational interface in [FRONTEND/app/(tabs)](FRONTEND/app/(tabs))

Tab layout is configured in [FRONTEND/app/(tabs)/_layout.tsx](FRONTEND/app/(tabs)/_layout.tsx).

### Feature-heavy screen groups
Inside [FRONTEND/app](FRONTEND/app) and subfolders:
- Income/Expenses
- Vendors/Suppliers/Purchases
- Inventory and stock adjustments
- Invoices and receipts
- Banking, cheques, transfers
- Lending/loan repayment
- Reports and accounting views
- Family settings and permissions

## 5.4 Frontend API Layer

Central client file: [FRONTEND/services/api.ts](FRONTEND/services/api.ts)

Key behavior:
- Computes platform-specific API base URL
- Supports env overrides for production/development
- Adds JWT auth header from AsyncStorage
- Contains typed request/response interfaces
- Has optional mock fallback mode for resilience

## 5.5 Frontend Environment Variables

Template: [FRONTEND/env.example](FRONTEND/env.example)

Variables used by API service include:
- `EXPO_PUBLIC_API_URL` (full URL override)
- `EXPO_PUBLIC_LOCAL_IP`
- `EXPO_PUBLIC_API_PORT`
- `EXPO_PUBLIC_ENABLE_MOCK_FALLBACK`

---

## 6) Backend–Frontend Integration Notes

1. **Auth flow**
   - Frontend calls auth endpoints.
   - Backend returns access/refresh tokens + user object.
   - Frontend stores token and fetches current user (`/api/auth/me`) to restore session.

2. **Tenant-aware behavior**
   - User records are linked to a tenant.
   - Data access and workflows are designed around tenant context.

3. **Accounting consistency**
   - High-level transactions are tied to accounting entities (accounts/journals) to preserve financial reporting integrity.

4. **Network configuration caveat**
   - Ensure frontend API host/port values match the backend runtime `PORT`.
   - This is especially important for emulator vs physical-device development.

---

## 7) Local Development Guide (Practical)

## Backend
1. Configure [backend/.env](backend/.env) from [backend/.env.example](backend/.env.example).
2. Install dependencies (`backend/package.json` scripts).
3. Initialize/migrate DB and seed where needed.
4. Start backend (`start`/`dev`).

## Frontend
1. Configure env values from [FRONTEND/env.example](FRONTEND/env.example).
2. Install dependencies.
3. Start Expo app.
4. Verify API base URL resolves correctly per platform.

## Docker option
Use [docker-compose.yml](docker-compose.yml) to run backend + postgres together.

---

## 8) Business Domain Summary (Why this project exists)

JIBUKS is designed to close the gap between:
- **simple household money tracking**, and
- **formal business/accounting operations**

in a single mobile-first product.

It supports real-world workflows such as:
- family budgeting and savings goals,
- supplier purchasing and inventory movement,
- invoicing and receivables,
- VAT-aware transactions,
- banking/cheque operations,
- and reporting based on structured accounting data.

This makes the system suitable for users that start with personal finance and grow into more structured business accounting without switching platforms.

---

## 9) Recommended Next Documentation Additions

For long-term maintainability, add:
- Endpoint-level API reference per route module
- ER diagram generated from Prisma schema
- Permission matrix by user role
- Accounting posting rules (debit/credit mapping per operation)
- Deployment runbook (staging/production)
- QA test matrix for family vs business flows
