# Auth-Gated App Testing Playbook (wiwiksayur.com)

The app supports two auth methods:
1. **Email + Password** (JWT bearer + `session_token` cookie)
2. **Emergent-managed Google OAuth** (session_id → session_token cookie, 7 days)

Both methods share the same `session_token` scheme. Backend `authenticator` reads `session_token` from cookie first, then `Authorization: Bearer` header.

## Test Users (also mirrored in /app/memory/test_credentials.md)
- Admin: `bagussatrioaje@gmail.com` / `Admin@123`
- Loyal customer: `setia@wiwiksayur.test` / `Setia@123` (10 completed orders → Pelanggan Setia badge)
- Regular customer: `reguler@wiwiksayur.test` / `Reguler@123`

## Backend API smoke test
```bash
BASE=https://delivery-market-12.preview.emergentagent.com/api
# 1. Register
curl -X POST $BASE/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Demo","email":"demo@test.com","phone":"+628123","password":"Demo@123"}'
# 2. Login
TOKEN=$(curl -sX POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"reguler@wiwiksayur.test","password":"Reguler@123"}' | jq -r .session_token)
# 3. Me
curl $BASE/auth/me -H "Authorization: Bearer $TOKEN"
# 4. Products
curl $BASE/products
```

## Frontend flow
1. Visit `/auth` → toggle Login / Register tabs.
2. Google button redirects to `https://auth.emergentagent.com/?redirect=<origin>/auth-callback`.
3. `AuthCallback` route processes `session_id` from URL hash (via `useLocation().hash`), exchanges via `/api/auth/google/session`, then redirects to `/`.
4. Admin badge (`role: admin`) unlocks `/admin` route.

## Checklist
- [ ] `POST /api/auth/register` returns `session_token` and cookie set.
- [ ] `POST /api/auth/login` returns `session_token` and cookie set.
- [ ] `GET /api/auth/me` with cookie returns user.
- [ ] `POST /api/auth/logout` clears cookie.
- [ ] Admin email is auto-tagged with `role=admin` after Google sign-in.
