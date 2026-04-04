# 02 Authentication

## What It Does
Authentication verifies user identity at login/signup and attaches session state using JWT.

## Core Flow
1. User signs up or logs in via user endpoints.
2. Backend verifies credentials (bcrypt for password hash check).
3. Backend creates JWT containing userId and role.
4. JWT is returned to frontend and also stored in user.jwt_token in DB.
5. Frontend stores token and user info in localStorage via AuthContext.
6. Each API call sends Bearer token through Axios interceptor.

## Key Backend Files
- backend/src/controllers/userController.js
  - createUser()
  - login()
  - logout()
- backend/src/models/userModel.js
  - getUserByEmail(), updateJwtToken()
- backend/src/middlewares/authenticateToken.js
  - Bearer parse, JWT verify, DB token match

## Token Validation Rules
- Missing token: 401
- Invalid/expired JWT: 401
- JWT valid but does not match DB-stored token: 401 (revoked session)
- Valid token: req.user and req.auth are populated for downstream checks

## Logout/Revoke Behavior
- logout endpoint clears jwt_token in DB
- Old token becomes unusable even before expiry

## Why This Design
- JWT keeps API stateless for verification.
- DB token storage adds server-side revocation control.
- User must re-auth after password/security changes.

## Viva Questions
- Why store JWT in DB if JWT is stateless?
- What happens when token is stolen but user logs out?
- How does middleware know token belongs to active session?

## Common Confusion
- Authentication answers: who are you?
- Authorization answers: what can you do?

## Technical MCR Map
- R: POST /api/users, POST /api/users/login, POST /api/users/logout
- C: userController.createUser(), login(), logout()
- M: userModel.createUser(), getUserByEmail(), updateJwtToken()

## Hard SQL / Security-Critical Queries
```sql
SELECT id, email, password_hash, status_id
FROM "user"
WHERE email = $1;
```
```sql
UPDATE "user"
SET jwt_token = $2
WHERE id = $1;
```
Middleware validation pattern:
```sql
SELECT id, jwt_token
FROM "user"
WHERE id = $1;
```
Then compare DB token with incoming Bearer JWT after JWT.verify().

## Why This Is Robust
- JWT signature check + DB token match gives revocation support.
- logout nullifies jwt_token, invalidating stolen old tokens.
