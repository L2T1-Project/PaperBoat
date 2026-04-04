# Authentication & Authorization — Feature Documentation

> Covers Signup (all roles), Login, Logout, Token Verification, how authorization works on every request, and the role system.

---

## Table of Contents

1. [Roles & Database Tables](#1-roles--database-tables)
2. [How the Token System Works](#2-how-the-token-system-works)
3. [Feature: Signup — Regular User](#3-feature-signup--regular-user)
4. [Feature: Signup — Researcher](#4-feature-signup--researcher)
5. [Feature: Signup — Venue User](#5-feature-signup--venue-user)
6. [Feature: Login](#6-feature-login)
7. [Feature: Logout](#7-feature-logout)
8. [Feature: Authorization Middleware (Every Protected Request)](#8-feature-authorization-middleware-every-protected-request)
9. [Feature: Token Verification (Session Restore)](#9-feature-token-verification-session-restore)
10. [Feature: Change Password](#10-feature-change-password)
11. [Frontend Auth State — AuthContext](#11-frontend-auth-state--authcontext)
12. [Frontend Axios Interceptors](#12-frontend-axios-interceptors)
13. [Role-Based Navigation (AppHeader)](#13-role-based-navigation-appheader)
14. [Public Routes (No Token Required)](#14-public-routes-no-token-required)

---

## 1. Roles & Database Tables

There are four roles. The `"user"` table holds every account. Role is determined by presence in a role-specific table, **not** a column in the user table.

```
"user" table
├── id, username, full_name, email
├── password_hash         ← bcrypt hash
├── jwt_token             ← stores the ACTIVE token (NULL when logged out)
├── status_id             ← FK → status table ("active", etc.)
└── phone_number, bio, profile_pic_url, created_at

Role tables (checked at login to determine JWT role claim):
├── admin        (user_id FK → user)   → role = "admin"
├── researcher   (user_id FK → user)   → role = "researcher"
├── venue_user   (user_id FK → user)   → role = "venue_user"
└── (none)                             → role = "user"
```

Role check priority at login (from `userController.js:192`):
```
admin → researcher → venue_user → user (default)
```

---

## 2. How the Token System Works

JWT tokens are used for authentication. There are two important design choices:

**1. Token stored in DB** — After login, the token is saved to `user.jwt_token`. This allows **server-side logout**: clearing that column invalidates the token immediately, even before expiry.

**2. Token sent in header** — Every request from the frontend adds `Authorization: Bearer <token>`. The middleware verifies the JWT signature AND checks it matches what is stored in the DB.

```
Token payload (signed with JWT_SECRET):
{
  userId: 42,
  role: "researcher",
  iat: ...,     // issued at
  exp: ...      // expires in 7 days
}
```

**Files:**
- Token creation: [`backend/src/controllers/userController.js:122`](backend/src/controllers/userController.js#L122), [`backend/src/controllers/userController.js:207`](backend/src/controllers/userController.js#L207)
- Token storage: [`backend/src/models/userModel.js:248`](backend/src/models/userModel.js#L248)
- Token validation: [`backend/src/middlewares/authenticateToken.js`](backend/src/middlewares/authenticateToken.js)
- Token attached to requests: [`frontend/src/api/axios.js:7`](frontend/src/api/axios.js#L7)

---

## 3. Feature: Signup — Regular User

**What happens:** User fills in name, username, email, password. A new `"user"` row is created with role = `"user"` (no entry in `admin`, `researcher`, or `venue_user`).

### Frontend

**File:** [`frontend/src/components/auth/SignupForm.jsx`](frontend/src/components/auth/SignupForm.jsx)

```jsx
// Zod schema validates before submit
const baseSchema = z.object({
  full_name: z.string().trim().min(1),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().regex(emailRegex),
  password: z.string().min(8),
  confirm_password: z.string(),
  // ...
});

// onSubmit (SignupForm.jsx:163)
const basePayload = buildPayload(values);   // { full_name, username, email, password }
let endpoint = "/users";                    // regular user → POST /api/users

const response = await api.post(endpoint, requestBody);
const { token, role, userId } = response.data;
login(token, { userId, role });             // save to AuthContext + localStorage
navigate("/dashboard", { replace: true });
```

### Backend

**Route:** `POST /api/users` (public — no auth required)

**File:** [`backend/src/controllers/userController.js:74`](backend/src/controllers/userController.js#L74)

```js
createUser = async (req, res) => {
  const { username, full_name, email, password } = req.body;

  // 1. Validate input
  if (!validateUsername(username)) { /* 400 */ }
  if (!validateEmail(email))       { /* 400 */ }
  if (!validatePassword(password)) { /* min 8 chars — 400 */ }

  // 2. Resolve status_id for "active"
  const status = await this.userModel.ensureStatusByName("active");

  // 3. Hash password with bcrypt (saltRounds = BCRYPT_SALT_ROUNDS env || 12)
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
  const password_hash = await bcrypt.hash(password, saltRounds);

  // 4. Insert into "user" table
  const user = await this.userModel.createUser({ username, full_name, email, password_hash, status_id, ... });

  // 5. Sign JWT with role = "user"
  const token = jwt.sign({ userId: user.id, role: "user" }, process.env.JWT_SECRET, { expiresIn: "7d" });

  // 6. Store token in DB (so logout can revoke it)
  await this.userModel.updateJwtToken(user.id, token);

  // 7. Return token + role + userId to frontend
  return res.status(201).json({ token, role: "user", userId: user.id });
}
```

**Model — INSERT:** [`backend/src/models/userModel.js:8`](backend/src/models/userModel.js#L8)

```js
INSERT INTO "user"
  (username, full_name, email, password_hash, phone_number, status_id, bio)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, username, full_name, email, ...;
```

### Full Workflow

```
User fills signup form
       │
       ▼
Zod schema validates (client-side)
  ├─ username: 3-30 chars, alphanumeric+underscore only
  ├─ email: regex check
  ├─ password: min 8 chars
  └─ confirm_password must match password
       │
       ▼
POST /api/users  { full_name, username, email, password }
       │
       ▼
userController.createUser()
  ├─ Server-side validation (same rules)
  ├─ ensureStatusByName("active") → resolves status_id
  ├─ bcrypt.hash(password, 12) → password_hash
  ├─ INSERT INTO "user" → user.id
  ├─ jwt.sign({ userId, role: "user" }, JWT_SECRET, { expiresIn: "7d" })
  └─ UPDATE "user" SET jwt_token = token WHERE id = user.id
       │
       ▼
201 { token, role: "user", userId }
       │
       ▼
Frontend: AuthContext.login(token, { userId, role })
  ├─ setToken(token), setUser({ userId, role })
  ├─ localStorage.setItem("pb_token", token)
  └─ localStorage.setItem("pb_user", JSON.stringify({ userId, role }))
       │
       ▼
navigate("/dashboard")
```

---

## 4. Feature: Signup — Researcher

**What happens:** Researcher must first look up their author profile (by ORC ID or name). The signup creates both a `"user"` row and a `researcher` row in a single DB transaction. Role = `"researcher"` is embedded in the JWT.

### Frontend — Researcher-specific step

**File:** [`frontend/src/components/auth/SignupForm.jsx:203`](frontend/src/components/auth/SignupForm.jsx#L203)

```jsx
// selectedRole === "researcher" → different endpoint + extra field
endpoint = "/researchers";
requestBody = {
  ...basePayload,
  author_id: resolvedAuthor.id,   // set after successful ORC ID or name lookup
};
```

`canSubmit` is blocked until `resolvedAuthor.id` is set (SignupForm.jsx:123):

```jsx
const canSubmit = useMemo(() => {
  if (selectedRole === "researcher") {
    return Boolean(resolvedAuthor?.id) || Boolean(claimedAlreadyAuthor);
  }
  // ...
}, [selectedRole, resolvedAuthor, ...]);
```

### Backend

**Route:** `POST /api/researchers` (public — no auth required)

**File:** [`backend/src/controllers/researcherController.js:31`](backend/src/controllers/researcherController.js#L31)

```js
createResearcher = async (req, res) => {
  const { full_name, username, email, password, author_id } = req.body;

  // 1. Hash password
  const password_hash = await bcrypt.hash(password, saltRounds);

  // 2. signupResearcher() runs in a DB transaction:
  const user = await this.researcherModel.signupResearcher({
    username, full_name, email, password_hash, status_id, author_id
  });

  // 3. Sign JWT with role = "researcher"
  const token = jwt.sign({ userId: user.id, role: "researcher" }, JWT_SECRET, { expiresIn: "7d" });

  // 4. Store token
  await this.userModel.updateJwtToken(user.id, token);

  return res.status(201).json({ token, role: "researcher", userId: user.id });
}
```

**Model — Transaction:** [`backend/src/models/researcherModel.js:37`](backend/src/models/researcherModel.js#L37)

```js
signupResearcher = async (payload) => {
  const client = await this.db.pool.connect();
  try {
    await client.query("BEGIN");

    // Step 1: Insert into "user" table
    INSERT INTO "user" (username, full_name, email, password_hash, ...) VALUES (...)
    RETURNING id, username, full_name, email;

    // Step 2: Insert into researcher table (links user to author profile)
    INSERT INTO researcher (user_id, author_id) VALUES ($1, $2)

    await client.query("COMMIT");
    return user;
  } catch (error) {
    await client.query("ROLLBACK");  // atomically undo both inserts on failure
    throw error;
  }
}
```

**Error handling for duplicate author_id** (`researcherController.js:92`):

```js
if (error.detail && error.detail.includes("author_id")) {
  return res.status(409).json({ error: "This author profile has already been claimed." });
}
```

### Full Workflow

```
User selects "Researcher" role
       │
       ▼
AuthorLookup component: user enters ORC ID → GET /api/authors/lookup/orc-id
  └─ resolvedAuthor.id is set if found and unclaimed
       │
       ▼
POST /api/researchers  { full_name, username, email, password, author_id }
       │
       ▼
researcherController.createResearcher()
  ├─ bcrypt.hash(password, 12)
  └─ researcherModel.signupResearcher() — DB transaction:
       ├─ BEGIN
       ├─ INSERT INTO "user" → user.id
       ├─ INSERT INTO researcher (user_id, author_id)
       └─ COMMIT  (or ROLLBACK if either insert fails)
       │
       ▼
jwt.sign({ userId, role: "researcher" }, ...)
UPDATE "user" SET jwt_token = token
       │
       ▼
201 { token, role: "researcher", userId }
       │
       ▼
Frontend: login(token, { userId, role: "researcher" }) → navigate("/dashboard")
```

---

## 5. Feature: Signup — Venue User

**What happens:** Similar to Researcher signup. User must first look up their venue by ISSN. Creates a `"user"` row and a `venue_user` row.

### Frontend

**File:** [`frontend/src/components/auth/SignupForm.jsx:210`](frontend/src/components/auth/SignupForm.jsx#L210)

```jsx
if (selectedRole === "venue_user") {
  endpoint = "/venue-users";
  requestBody = {
    ...basePayload,
    venue_id: resolvedVenue.id,    // set after successful ISSN lookup
  };
}
```

The pattern is identical to Researcher signup — `canSubmit` requires `resolvedVenue.id`. The backend creates both the `"user"` and `venue_user` rows in a transaction.

---

## 6. Feature: Login

**What happens:** User provides email + password. Backend verifies password against the bcrypt hash, checks account is active, determines role, signs a new JWT, stores it in DB, returns it to frontend.

### Frontend

**File:** [`frontend/src/components/auth/LoginForm.jsx:58`](frontend/src/components/auth/LoginForm.jsx#L58)

```jsx
const onSubmit = async (values) => {
  const response = await api.post("/users/login", {
    email: values.email,
    password: values.password,
  });

  const { token, role, userId } = response.data;
  login(token, { userId, role });          // AuthContext.login()
  navigate("/dashboard", { replace: true });
};
```

Rate-limit error is surfaced to user (LoginForm.jsx:22):

```jsx
function buildLoginErrorMessage(error) {
  const status = error?.response?.status;
  if (status === 429) {
    const retrySeconds = apiMessage?.match(/(\d+)\s*seconds?/i)?.[1];
    return `Too many attempts. Try again in ${retrySeconds} seconds.`;
  }
  return apiMessage || "Unable to login. Please try again.";
}
```

### Backend

**Route:** `POST /api/users/login` (public — no auth required)

**File:** [`backend/src/controllers/userController.js:148`](backend/src/controllers/userController.js#L148)

```js
login = async (req, res) => {
  const { email, password } = req.body;

  // 1. Input validation
  if (!validateEmail(email)) { /* 400 */ }

  // 2. Rate limiting (in-memory, per IP)
  const clientIp = req.ip || req.connection.remoteAddress;
  const rateCheck = checkRateLimit(clientIp);   // max 5 attempts per 15 min
  if (rateCheck.blocked) {
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${retryAfter} seconds.` });
  }

  // 3. Look up user by email
  const user = await this.userModel.getUserByEmail(email);
  if (!user) {
    recordFailedLogin(clientIp);              // increment failed attempt counter
    return res.status(401).json({ error: "Invalid email or password." });
  }

  // 4. Check account is active
  const status = await this.userModel.getStatusById(user.status_id);
  if (status.status_name.toLowerCase() !== "active") {
    return res.status(403).json({ error: "Your account is not active." });
  }

  // 5. Verify password
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    recordFailedLogin(clientIp);
    return res.status(401).json({ error: "Invalid email or password." });
  }

  clearFailedLogins(clientIp);               // reset counter on success

  // 6. Determine role by checking role tables
  let role = "user";
  const admin = await this.userModel.checkAdminRole(user.id);        // SELECT FROM admin
  if (admin) {
    role = "admin";
  } else {
    const researcher = await this.userModel.checkResearcherRole(user.id);  // SELECT FROM researcher
    if (researcher) {
      role = "researcher";
    } else {
      const venueUser = await this.userModel.checkVenueUserRole(user.id);  // SELECT FROM venue_user
      if (venueUser) { role = "venue_user"; }
    }
  }

  // 7. Sign new JWT
  const token = jwt.sign({ userId: user.id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });

  // 8. Overwrite stored token in DB (old token is now invalid)
  await this.userModel.updateJwtToken(user.id, token);

  return res.status(200).json({ token, role, userId: user.id });
}
```

**Rate limit implementation** (in-memory Map, `userController.js:6`):

```js
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;  // 15 minutes

// Each IP maps to: { count, firstAttempt }
// Window resets after 15 min of no attempts
// Cleared immediately on successful login
```

### Full Workflow

```
User submits login form (email + password)
       │
       ▼
Zod validation (client-side: email format, password min 8)
       │
       ▼
POST /api/users/login  { email, password }
       │
       ▼
userController.login()
  ├─ Validate email format
  ├─ checkRateLimit(clientIp)  →  blocked? → 429
  ├─ getUserByEmail(email)     →  not found? → 401 + recordFailedLogin()
  ├─ getStatusById()           →  not "active"? → 403
  ├─ bcrypt.compare(password, hash)  →  mismatch? → 401 + recordFailedLogin()
  ├─ clearFailedLogins(clientIp)
  ├─ checkAdminRole() / checkResearcherRole() / checkVenueUserRole()
  ├─ jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" })
  └─ UPDATE "user" SET jwt_token = newToken
       │
       ▼
200 { token, role, userId }
       │
       ▼
AuthContext.login(token, { userId, role })
  ├─ localStorage.setItem("pb_token", token)
  ├─ localStorage.setItem("pb_user", JSON.stringify({ userId, role }))
  └─ setToken / setUser in React state
       │
       ▼
navigate("/dashboard")
All future requests: axios interceptor auto-attaches Authorization: Bearer <token>
```

---

## 7. Feature: Logout

**What happens:** The stored JWT is set to NULL in the database. Even if someone still has the old token string, the middleware will reject it because it no longer matches what's in the DB. Frontend clears localStorage and redirects to `/login`.

### Frontend

**File:** [`frontend/src/context/AuthContext.jsx:78`](frontend/src/context/AuthContext.jsx#L78)

```js
const logout = async () => {
  try {
    if (token) {
      await api.post("/users/logout");       // tells backend to clear jwt_token in DB
    }
  } catch {
    // Even if API call fails, clear local state anyway
  } finally {
    setToken(null);
    setUser(null);
    localStorage.removeItem("pb_token");
    localStorage.removeItem("pb_user");

    if (window.location.pathname !== "/login") {
      window.location.href = "/login";       // hard redirect
    }
  }
};
```

Called from the Logout button in the header:

**File:** [`frontend/src/components/layout/AppHeader.jsx:181`](frontend/src/components/layout/AppHeader.jsx#L181)

```jsx
<button onClick={logout}>Logout</button>
```

### Backend

**Route:** `POST /api/users/logout` (requires auth)

**File:** [`backend/src/controllers/userController.js:244`](backend/src/controllers/userController.js#L244)

```js
logout = async (req, res) => {
  const userId = req.auth.userId;            // from decoded JWT (already validated by middleware)
  await this.userModel.clearJwtToken(userId);
  return res.status(200).json({ message: "Logged out successfully." });
}
```

**Model:** [`backend/src/models/userModel.js:261`](backend/src/models/userModel.js#L261)

```js
clearJwtToken = async (userId) => {
  UPDATE "user"
  SET jwt_token = NULL
  WHERE id = $1
  RETURNING id;
}
```

### Full Workflow

```
User clicks "Logout" button (AppHeader.jsx)
       │
       ▼
AuthContext.logout() called
       │
       ▼
POST /api/users/logout   (with Authorization: Bearer <token> header)
       │
       ▼
authenticateToken middleware runs first (validates token)
       │
       ▼
userController.logout()
  └─ UPDATE "user" SET jwt_token = NULL WHERE id = userId
       │
       ▼
200 "Logged out successfully."
       │
       ▼
finally block always runs:
  ├─ setToken(null), setUser(null)
  ├─ localStorage.removeItem("pb_token")
  ├─ localStorage.removeItem("pb_user")
  └─ window.location.href = "/login"

Result: old token is dead server-side. Even if token string is kept,
middleware will reject it ("Token has been revoked. Please log in again.")
```

---

## 8. Feature: Authorization Middleware (Every Protected Request)

**What happens:** A middleware runs on every non-public request. It extracts the token from the `Authorization` header, verifies the JWT signature, confirms the user exists, and checks the token matches what is stored in the DB. This is what enforces server-side logout.

**File:** [`backend/src/middlewares/authenticateToken.js`](backend/src/middlewares/authenticateToken.js)

```js
authenticateToken = async (req, res, next) => {
  // Dev bypass: if BYPASS=true in .env, skip all auth
  if (process.env.BYPASS === "true") { return next(); }

  // 1. Extract token from Authorization header
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  const token = authHeader && authHeader.split(" ")[1];    // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  // 2. Verify JWT signature + expiry
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  // Throws TokenExpiredError or JsonWebTokenError if invalid

  req.auth = decoded;     // { userId, role, iat, exp }

  // 3. Confirm user still exists in DB
  const userId = decoded.userId;
  const user = await this.userModel.getUserById(userId);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  // 4. Check token matches DB (server-side revocation check)
  const storedToken = await this.userModel.getJwtTokenByUserId(userId);
  if (!storedToken || storedToken.jwt_token !== token) {
    return res.status(401).json({ message: "Token has been revoked. Please log in again." });
  }

  req.user = user;
  if (req.user && !req.user.role && decoded.role) {
    req.user.role = decoded.role;    // attach role from JWT to req.user
  }

  next();
};
```

**Error cases:**

| Situation | HTTP status | Message |
|-----------|-------------|---------|
| No token in header | 401 | "Access token required" |
| JWT signature invalid | 403 | "Invalid token" |
| JWT expired | 401 | "Token expired" |
| User deleted from DB | 401 | "User not found" |
| Token revoked (logged out) | 401 | "Token has been revoked. Please log in again." |

**How middleware is applied globally** (`backend/src/index.js:93`):

```js
app.use((req, res, next) => {
  const isPublic = publicRoutes.some(
    (route) => route.method === req.method && doesPathMatch(route.path, req.path)
  );

  if (isPublic) {
    return next();       // skip auth for public routes
  }

  return authInstance.authenticateToken(req, res, next);
});
```

The `doesPathMatch()` function supports Express-style params like `:id`:

```js
// e.g. "/api/authors/:id/papers" matches "/api/authors/42/papers"
function doesPathMatch(routePath, requestPath) {
  // splits both by "/" and checks each segment
  // skips comparison for segments starting with ":"
}
```

### Full Workflow (any protected API call)

```
Frontend makes any request (e.g. GET /api/notifications)
       │
       ▼
axios interceptor (frontend/src/api/axios.js:7) adds:
  Authorization: Bearer <token from localStorage>
       │
       ▼
Express global middleware (index.js:93) checks publicRoutes list
  └─ not public → runs authenticateToken()
       │
       ▼
authenticateToken():
  ├─ Extract token from header
  ├─ jwt.verify(token, JWT_SECRET)       → invalid/expired → 401/403
  ├─ getUserById(decoded.userId)          → not found → 401
  └─ getJwtTokenByUserId(userId)          → mismatch → 401 (revoked)
       │
       ▼
req.auth = { userId, role, iat, exp }
req.user = user row from DB
next() → actual controller runs
```

---

## 9. Feature: Token Verification (Session Restore)

**What happens:** When the app loads, `AuthContext` reads token from `localStorage`. To confirm the session is still valid (user wasn't deleted, token wasn't revoked), the app can call `GET /api/users/verify`.

### Frontend — Session restore on app load

**File:** [`frontend/src/context/AuthContext.jsx:45`](frontend/src/context/AuthContext.jsx#L45)

```js
useEffect(() => {
  const storedToken = localStorage.getItem("pb_token");
  const storedUser = parseStoredUser(localStorage.getItem("pb_user"));  // validates shape

  if (storedToken && storedUser) {
    // Trust the stored data to restore session immediately (no network call)
    setToken(storedToken);
    setUser(storedUser);
    setIsAuthReady(true);
    return;
  }

  // Invalid or missing storage — clear and set ready
  localStorage.removeItem("pb_token");
  localStorage.removeItem("pb_user");
  setIsAuthReady(true);
}, []);
```

Note: The app restores session from `localStorage` directly without calling `/verify`. If the token has been revoked server-side, the next actual API call will return 401, and the axios interceptor will clear localStorage and redirect to `/login`.

### Backend — Verify endpoint

**Route:** `GET /api/users/verify` (requires auth — middleware runs first)

**File:** [`backend/src/controllers/userController.js:223`](backend/src/controllers/userController.js#L223)

```js
verifyToken = async (req, res) => {
  const userId = req.auth && req.auth.userId;    // set by middleware

  const user = await this.userModel.getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  return res.status(200).json({
    userId: user.id,
    role: req.auth.role || "user",
  });
}
```

---

## 10. Feature: Change Password

**What happens:** Logged-in user provides current and new password. Backend verifies the current one, hashes the new one, saves it, and **clears the JWT token** — forcing the user to log in again with the new password.

### Backend

**Route:** `POST /api/users/change-password` (requires auth)

**File:** [`backend/src/controllers/userController.js:257`](backend/src/controllers/userController.js#L257)

```js
changePassword = async (req, res) => {
  const userId = req.auth.userId;
  const { current_password, new_password } = req.body;

  // 1. Validate new password length
  if (!validatePassword(new_password)) { /* 400 — min 8 chars */ }

  // 2. Get current hash
  const record = await this.userModel.getPasswordHashByUserId(userId);

  // 3. Verify current password
  const match = await bcrypt.compare(current_password, record.password_hash);
  if (!match) { return res.status(401).json({ error: "Current password is incorrect." }); }

  // 4. Hash new password and save
  const newHash = await bcrypt.hash(new_password, saltRounds);
  await this.userModel.updatePasswordHash(userId, newHash);

  // 5. Invalidate all active sessions by clearing the token
  await this.userModel.clearJwtToken(userId);

  return res.status(200).json({ message: "Password changed successfully. Please log in again." });
}
```

---

## 11. Frontend Auth State — AuthContext

**File:** [`frontend/src/context/AuthContext.jsx`](frontend/src/context/AuthContext.jsx)

The `AuthContext` is the single source of truth for auth state in the frontend. It is provided at the top of the React tree so every component can access it.

```js
// State managed:
const [token, setToken] = useState(null);    // JWT string
const [user, setUser] = useState(null);      // { userId, role }
const [isAuthReady, setIsAuthReady] = useState(false);

// Computed:
isAuthenticated: Boolean(token && user)

// Methods exposed:
login(token, userObj)   // called after signup or login API call
logout()                // calls API + clears state + redirects
```

**`parseStoredUser()`** — validates the shape of data from localStorage before trusting it (AuthContext.jsx:6):

```js
function parseStoredUser(rawUser) {
  const parsed = JSON.parse(rawUser);
  // Must have: userId (number or string), role (string)
  // Normalizes: userId → Number, role → trim().toLowerCase()
  return parsed;
}
```

**What `login()` does** (AuthContext.jsx:61):

```js
const login = (nextToken, userObj) => {
  const normalizedUser = {
    userId: Number(userObj.userId),
    role: String(userObj.role).trim().toLowerCase(),
  };
  setToken(nextToken);
  setUser(normalizedUser);
  localStorage.setItem("pb_token", nextToken);
  localStorage.setItem("pb_user", JSON.stringify(normalizedUser));
};
```

---

## 12. Frontend Axios Interceptors

**File:** [`frontend/src/api/axios.js`](frontend/src/api/axios.js)

Two interceptors are registered on the shared `api` axios instance:

**Request interceptor — auto-attach token:**

```js
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pb_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

Every API call automatically gets the token. Components do not need to manually set headers.

**Response interceptor — handle 401:**

```js
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // Token expired, revoked, or invalid
      localStorage.removeItem("pb_token");
      localStorage.removeItem("pb_user");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";    // hard redirect, clears React state too
      }
    }
    return Promise.reject(error);
  }
);
```

This means if a token expires mid-session or is revoked, the user is automatically sent to login on the next request — no extra handling needed in components.

---

## 13. Role-Based Navigation (AppHeader)

**File:** [`frontend/src/components/layout/AppHeader.jsx:7`](frontend/src/components/layout/AppHeader.jsx#L7)

The header renders different nav links depending on `user.role` from `AuthContext`:

```js
const ROLE_NAV = {
  guest:       [ Papers, Authors, Venues ],
  user:        [ Papers, Authors, Venues, Dashboard, Statistics, Library, Feedback ],
  researcher:  [ Papers, Authors, Venues, Dashboard, Statistics, SuggestPaper, Library, Feedback ],
  venue_user:  [ Papers, Authors, Venues, Dashboard, Statistics, Library, Feedback ],
  admin:       [ Papers, Authors, Venues, Dashboard, Statistics, ClaimQueue, AddPaper, FeedbackInbox, DuplicateClaims ],
};

const roleKey = isAuthenticated ? user?.role || "user" : "guest";
const navItems = ROLE_NAV[roleKey] || ROLE_NAV.user;
```

Extra conditional link for researchers (AppHeader.jsx:143):

```jsx
{isAuthenticated && user?.role === "researcher" && (
  <NavLink to={`/researchers/${user.userId}/claims`} label="My Claims" />
)}
```

---

## 14. Public Routes (No Token Required)

**File:** [`backend/src/index.js:32`](backend/src/index.js#L32)

These routes bypass the auth middleware entirely. Everything else requires a valid token.

```js
const publicRoutes = [
  // Auth
  { method: "POST", path: "/api/users/login" },
  { method: "POST", path: "/api/users" },            // user signup
  { method: "POST", path: "/api/researchers" },      // researcher signup
  { method: "POST", path: "/api/venue-users" },      // venue user signup

  // Read-only public data
  { method: "GET", path: "/api/papers" },
  { method: "GET", path: "/api/papers/:id" },
  { method: "GET", path: "/api/authors" },
  { method: "GET", path: "/api/authors/:id" },
  { method: "GET", path: "/api/authors/:id/papers" },
  { method: "GET", path: "/api/venues" },
  { method: "GET", path: "/api/venues/:id" },
  { method: "GET", path: "/api/topics" },
  // ... and more read-only author/venue/paper routes
];
```

---

## Summary

| Feature | Route | Auth Required | Key Code |
|---------|-------|---------------|----------|
| User Signup | `POST /api/users` | No | `userController.createUser` |
| Researcher Signup | `POST /api/researchers` | No | `researcherController.createResearcher` + `signupResearcher()` transaction |
| Venue User Signup | `POST /api/venue-users` | No | `venueUserController` |
| Login | `POST /api/users/login` | No | `userController.login` — bcrypt compare + role check + jwt.sign |
| Logout | `POST /api/users/logout` | Yes | `userController.logout` — clears `jwt_token` in DB |
| Verify Session | `GET /api/users/verify` | Yes | `userController.verifyToken` |
| Change Password | `POST /api/users/change-password` | Yes | bcrypt compare + hash new + clearJwtToken |
| Every protected call | (middleware) | Yes | `authenticateToken` — verifies JWT + checks DB token match |

### Key Security Properties

- **Passwords:** Never stored plaintext. Bcrypt with 12 salt rounds (configurable via `BCRYPT_SALT_ROUNDS`).
- **Token revocation:** JWT is stored in `user.jwt_token`. Logout = `SET jwt_token = NULL`. The middleware rejects any token not matching what's in DB.
- **Rate limiting:** In-memory per-IP counter. 5 failed login attempts locks the IP for 15 minutes.
- **Account status:** Login explicitly checks `status_name = "active"`. Inactive accounts cannot log in even with correct password.
- **Role in JWT:** Role is embedded in the token payload at login time. Controllers and the frontend read `req.auth.role` / `user.role` for authorization decisions.
- **Session restore:** Frontend trusts `localStorage` on page load. Invalid/revoked tokens are caught on the first real API call via the 401 interceptor.
