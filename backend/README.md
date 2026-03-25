-- Active: 1759839836649@@localhost@5432@APP
# JIBUKS Backend

Node.js + Express backend for the JIBUKS mobile app.

## Features
- Express server with JSON API
- PostgreSQL with tenants + users schema
- JWT-based authentication and protected endpoints
- Auth0 OAuth2 integration
- User management with bcrypt password hashing
- Multi-tenant support

## Database Schema
- **tenants**: Organizations/workspaces with owner and metadata
- **users**: Users linked to tenants, supporting both local auth and OAuth2 (Auth0)

## Getting Started

### 1. Copy and configure `.env`
```bash
cp .env.example .env
# Edit .env with your database credentials and JWT secret
```

Example `.env`:
```
PORT=4000
DATABASE_URL=postgresql://postgres:1901@localhost:5432/jibuk
JWT_SECRET=your-secret-key-change-in-production
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
```

### 2. Install dependencies
```bash
npm install
```

### 3. Initialize the database
```bash
npm run db:init
```

### 4. Start the server
- **Development** (with auto-reload): `npm run dev`
- **Production**: `npm start`

Server listens on `http://localhost:4000`

## API Endpoints

### Authentication (Public)
- `POST /auth/login` - Local login with email/password
- `POST /auth/oauth2-login` - OAuth2 login with Auth0 token
- `GET /auth/auth0/callback` - Auth0 callback handler
- `POST /auth/refresh-token` - Refresh access token
- `POST /auth/logout` - Logout

### User Profile (Protected)
- `GET /auth/me` - Get current user

### Users (Protected)
- `GET /users` - List all users
- `POST /users` - Create a new user

## Authentication Flow

### Local Login
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com", "password": "secret" }'
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "email": "user@example.com", "name": "John", "tenant_id": 1 }
}
```

### OAuth2 Login (Auth0)
1. Mobile app gets Auth0 ID token
2. Send to `/auth/oauth2-login` with `auth0_id`, `email`, `name`
3. Backend creates user if new, returns JWT tokens

```bash
curl -X POST http://localhost:4000/auth/oauth2-login \
  -H "Content-Type: application/json" \
  -d '{
    "auth0_id": "auth0|...",
    "email": "user@auth0.com",
    "name": "John Doe"
  }'
```

### Protected Endpoints
Include JWT in `Authorization` header:
```bash
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer <your-access-token>"
```

## React Native Integration

1. **For local dev**: Use `http://<your-machine-ip>:4000`
2. **For production**: Use your deployed backend URL

Example with `fetch`:
```javascript
const response = await fetch('http://localhost:4000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const { accessToken } = await response.json();

// Use token in subsequent requests
fetch('http://localhost:4000/auth/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` },
});
```

## Next Steps
- Set up Auth0 account and configure `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`
- Add token blacklist/refresh token rotation for logout
- Implement role-based access control (RBAC)
- Add email verification and password reset flows
- Deploy to production (AWS, Heroku, etc.)

