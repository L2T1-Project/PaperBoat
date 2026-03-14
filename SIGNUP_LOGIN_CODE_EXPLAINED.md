# Signup, Login, Logout, and Security Code Walkthrough

This file extracts the backend code that currently drives signup, login, logout, password management, and security hardening in OpenScholars and explains each part in order.

The flow in this backend is:

`Route -> Controller -> Model -> PostgreSQL -> JWT storage -> Auth middleware`

**Security features covered:**

- Password hashing with bcrypt
- JWT-based authentication with server-side token validation
- Logout via token revocation
- Login rate limiting (brute-force protection)
- Input validation (email format, password strength, username format)
- Change-password with session invalidation

## 1. Supporting Packages and Environment

### `backend/package.json`

```json
{
  "dependencies": {
    "bcrypt": "^6.0.0",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.3",
    "nodemon": "^3.1.11",
    "pg": "^8.16.3"
  }
}
```

Explanation:

- `bcrypt` hashes passwords during signup and verifies them during login.
- `jsonwebtoken` creates the JWT returned after successful signup or login.
- `pg` is the PostgreSQL driver used by all models.
- `dotenv` loads `.env` so `JWT_SECRET` and `BCRYPT_SALT_ROUNDS` are available.

### `backend/.env`

```env
PORT=3000
DATABASE_URL=postgresql://...
BCRYPT_SALT_ROUNDS=12
LOG_SQL=true
JWT_SECRET=your_super_secret_key
```

Explanation:

- `BCRYPT_SALT_ROUNDS=12` controls password hashing strength.
- `JWT_SECRET` is the secret used to sign and verify tokens.

## 2. App-Level Route Mounting and Auth Gate

### `backend/src/index.js`

```js
const AuthenticateToken = require("./middlewares/authenticateToken.js");

const app = express();
app.use(express.json());
app.use(cors());

const authInstance = new AuthenticateToken();
const publicRoutes = [
  { method: "POST", path: "/api/users/login" },
  { method: "POST", path: "/api/users" },
  { method: "GET", path: "/api/users/statuses" },
  { method: "GET", path: "/api/users/status/all" },
  { method: "GET", path: "/api/authors/lookup/orc-id" },
  { method: "GET", path: "/api/authors/lookup/name" },
  { method: "POST", path: "/api/researchers" },
  { method: "GET", path: "/api/venues/lookup/issn" },
  { method: "GET", path: "/api/venues/lookup/name" },
  { method: "POST", path: "/api/venue-users" },
];

app.use((req, res, next) => {
  const isPublic = publicRoutes.some(
    (r) => r.method === req.method && req.path === r.path,
  );
  if (isPublic) return next();
  return authInstance.authenticateToken(req, res, next);
});

const userRouter = new UserRouter();
app.use("/api/users", userRouter.getRouter());

const authorRouter = new AuthorRouter();
app.use("/api/authors", authorRouter.getRouter());

const researcherRouter = new ResearcherRouter();
app.use("/api/researchers", researcherRouter.getRouter());

const venueRouter = new VenueRouter();
app.use("/api/venues", venueRouter.getRouter());

const venueUserRouter = new VenueUserRouter();
app.use("/api/venue-users", venueUserRouter.getRouter());
```

Explanation:

- This is the global entry point for auth-related routing.
- The `publicRoutes` array allows signup and login requests to bypass token verification.
- Every other request passes through `authenticateToken`.
- The auth-related routers are mounted here:
  `users`, `authors`, `researchers`, `venues`, and `venue-users`.

Current implementation note:

- Researcher and venue signup discovery logic is implemented in `GET /api/authors?orc_id=...`, `GET /api/authors?name=...`, `GET /api/venues?issn=...`, and `GET /api/venues?name=...`.
- The `publicRoutes` list currently whitelists `/lookup/...` endpoints instead. That means the query-parameter endpoints are documented in code, but the global auth gate is not aligned with them.

## 3. Auth Middleware (with Server-Side Token Validation)

### `backend/src/middlewares/authenticateToken.js`

```js
const UserModel = require("../models/userModel.js");
const jwt = require("jsonwebtoken");

class AuthenticateToken {
  constructor() {
    this.userModel = new UserModel();
  }

  authenticateToken = async (req, res, next) => {
    try {
      if (process.env.BYPASS === "true") {
        return next();
      }

      const authHeader =
        req.headers["authorization"] || req.headers["Authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access token required",
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.auth = decoded;

      const userId = decoded.userId;
      const user = await this.userModel.getUserById(userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Verify presented token matches stored jwt_token in DB
      // This enables server-side token invalidation (logout, password change, etc.)
      const storedToken = await this.userModel.getJwtTokenByUserId(userId);
      if (!storedToken || storedToken.jwt_token !== token) {
        return res.status(401).json({
          success: false,
          message: "Token has been revoked. Please log in again.",
        });
      }

      req.user = user;
      if (req.user && !req.user.role && decoded && decoded.role) {
        req.user.role = decoded.role;
      }
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired",
        });
      }
      return res.status(403).json({
        success: false,
        message: "Invalid token",
      });
    }
  };
}

module.exports = AuthenticateToken;
```

Explanation:

- This middleware verifies the JWT created during signup or login.
- It reads the token from the `Authorization: Bearer <token>` header.
- `jwt.verify` decodes the payload using `JWT_SECRET`.
- `decoded.userId` is used to load the current user from the database.
- **New:** After loading the user, it fetches the stored `jwt_token` from the database and compares it against the presented token. If they don't match (e.g. user logged out or changed password), the request is rejected with 401.
- This enables proper server-side token revocation — clearing `jwt_token` in the database immediately invalidates the session.
- The earlier typo was fixed by exporting with `module.exports`.

## 4. User Routes for Signup, Login, Logout, and Password Change

### `backend/src/routes/userRoutes.js`

```js
this.router.post("/login", this.userController.login);
this.router.get("/statuses", this.userController.getAllStatuses);
this.router.get("/status/all", this.userController.getAllStatuses);
this.router.get("/verify", this.userController.verifyToken);

// Logout and change-password routes (both require authentication)
this.router.post("/logout", this.userController.logout);
this.router.post("/change-password", this.userController.changePassword);

this.router.post("/", this.userController.createUser);
```

Explanation:

- `POST /api/users` is the regular user signup endpoint.
- `POST /api/users/login` is the login endpoint.
- `GET /api/users/statuses` supports resolving the active status used by signup.
- `GET /api/users/verify` is the follow-up endpoint used after token verification.
- **New:** `POST /api/users/logout` clears the stored JWT to invalidate the session.
- **New:** `POST /api/users/change-password` allows authenticated users to update their password.
- Both `/logout` and `/change-password` are NOT in the `publicRoutes` list, so they require a valid token.

## 5. Field Validation Helpers and Rate Limiter

### `backend/src/controllers/userController.js` — Top of File

```js
const UserModel = require("../models/userModel.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// In-memory rate limiter for login brute-force protection
// Tracks failed login attempts per IP address
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5; // max failed attempts before lockout
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15-minute window

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { blocked: false };
  if (now - record.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { blocked: false };
  }
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    const retryAfter = Math.ceil(
      (record.firstAttempt + LOGIN_WINDOW_MS - now) / 1000,
    );
    return { blocked: true, retryAfter };
  }
  return { blocked: false };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

function clearFailedLogins(ip) {
  loginAttempts.delete(ip);
}

// Field validation helpers
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

function validateEmail(email) {
  return typeof email === "string" && EMAIL_REGEX.test(email);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= PASSWORD_MIN_LENGTH;
}

function validateUsername(username) {
  return (
    typeof username === "string" &&
    username.length >= 3 &&
    username.length <= 30 &&
    /^[a-zA-Z0-9_]+$/.test(username)
  );
}
```

Explanation:

- **Rate limiter:** Uses an in-memory `Map` keyed by IP address. After 5 failed login attempts within a 15-minute window, the IP is blocked with a 429 response. Successful logins clear the counter.
- **Email validation:** Checks basic email format with a regex (`user@domain.tld`).
- **Password validation:** Enforces a minimum of 8 characters.
- **Username validation:** Allows only alphanumeric characters and underscores, between 3-30 characters.
- These helpers are used by `createUser`, `login`, and `changePassword`.

## 6. Regular User Signup Controller (with Validation)

### `backend/src/controllers/userController.js`

```js
createUser = async (req, res) => {
  try {
    const { username, full_name, email, password, phone_number, bio } =
      req.body;

    if (!username || !full_name || !email || !password) {
      return res.status(400).json({
        error: "username, full_name, email, and password are required.",
      });
    }

    // Input validation
    if (!validateUsername(username)) {
      return res.status(400).json({
        error:
          "Username must be 3-30 characters and contain only letters, numbers, and underscores.",
      });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long.",
      });
    }

    const status = await this.userModel.getStatusByName("active");
    if (!status) {
      return res
        .status(500)
        .json({ error: "Could not resolve active status." });
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const user = await this.userModel.createUser({
      username,
      full_name,
      email,
      password_hash,
      phone_number: phone_number || null,
      status_id: status.id,
      bio: bio || null,
    });

    const token = jwt.sign(
      { userId: user.id, role: "user" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    await this.userModel.updateJwtToken(user.id, token);

    return res.status(201).json({ token, role: "user", userId: user.id });
  } catch (error) {
    if (error.code === "23505") {
      if (error.detail && error.detail.includes("email")) {
        return res.status(409).json({ error: "Email already in use." });
      }
      if (error.detail && error.detail.includes("username")) {
        return res.status(409).json({ error: "Username already taken." });
      }
      return res.status(409).json({
        error: "A user with that email or username already exists.",
      });
    }
    return res.status(500).json({ error: "Internal server error." });
  }
};
```

Explanation:

- **New:** Before proceeding to the database, the controller now validates username format, email format, and password strength.
- It resolves the `active` row from the `status` table instead of hardcoding a numeric ID.
- The plain password is hashed with bcrypt before any insert happens.
- After the user row is inserted, a JWT is created with payload `{ userId, role: "user" }`.
- The generated token is also saved into the `jwt_token` column.
- Duplicate email and duplicate username are translated into `409` responses.

## 7. User Model Methods Used by Signup, Login, Logout, and Password Change

### `backend/src/models/userModel.js`

```js
createUser = async (payload) => {
  const {
    username,
    full_name,
    email,
    password_hash,
    phone_number = null,
    status_id,
    bio = null,
  } = payload;

  const query = `
          INSERT INTO "user"
              (username, full_name, email, password_hash, phone_number, status_id, bio)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, username, full_name, email, phone_number, profile_pic_url, status_id, created_at, bio;
      `;

  const params = [
    username,
    full_name,
    email,
    password_hash,
    phone_number,
    status_id,
    bio,
  ];
  const result = await this.db.query_executor(query, params);
  return result.rows[0];
};

getUserByEmail = async (email) => {
  const query = `
          SELECT *
          FROM "user"
          WHERE email = $1;
      `;

  const result = await this.db.query_executor(query, [email]);
  return result.rows[0] || null;
};

updateJwtToken = async (userId, token) => {
  const query = `
          UPDATE "user"
          SET jwt_token = $2
          WHERE id = $1
          RETURNING id;
      `;

  const result = await this.db.query_executor(query, [userId, token]);
  return result.rows[0] || null;
};

// Clear jwt_token on logout (sets to NULL)
clearJwtToken = async (userId) => {
  const query = `
          UPDATE "user"
          SET jwt_token = NULL
          WHERE id = $1
          RETURNING id;
      `;
  const result = await this.db.query_executor(query, [userId]);
  return result.rows[0] || null;
};

// Get stored jwt_token for token-match verification in middleware
getJwtTokenByUserId = async (userId) => {
  const query = `SELECT jwt_token FROM "user" WHERE id = $1;`;
  const result = await this.db.query_executor(query, [userId]);
  return result.rows[0] || null;
};

// Get password_hash for change-password verification
getPasswordHashByUserId = async (userId) => {
  const query = `SELECT password_hash FROM "user" WHERE id = $1;`;
  const result = await this.db.query_executor(query, [userId]);
  return result.rows[0] || null;
};

// Update password_hash for change-password
updatePasswordHash = async (userId, passwordHash) => {
  const query = `
          UPDATE "user"
          SET password_hash = $2
          WHERE id = $1
          RETURNING id;
      `;
  const result = await this.db.query_executor(query, [userId, passwordHash]);
  return result.rows[0] || null;
};

getStatusByName = async (statusName) => {
  const query = `SELECT id, status_name FROM status WHERE LOWER(status_name) = LOWER($1);`;
  const result = await this.db.query_executor(query, [statusName]);
  return result.rows[0] || null;
};

getStatusById = async (statusId) => {
  const query = `SELECT id, status_name FROM status WHERE id = $1;`;
  const result = await this.db.query_executor(query, [statusId]);
  return result.rows[0] || null;
};

checkResearcherRole = async (userId) => {
  const query = `SELECT user_id FROM researcher WHERE user_id = $1;`;
  const result = await this.db.query_executor(query, [userId]);
  return result.rows[0] || null;
};

checkVenueUserRole = async (userId) => {
  const query = `SELECT user_id FROM venue_user WHERE user_id = $1;`;
  const result = await this.db.query_executor(query, [userId]);
  return result.rows[0] || null;
};
```

Explanation:

- `createUser` inserts the regular user record using the already-hashed password.
- `getUserByEmail` is the main lookup for login.
- `updateJwtToken` persists the latest JWT into the database.
- **New:** `clearJwtToken` sets `jwt_token` to `NULL` — used by logout and change-password to revoke the session.
- **New:** `getJwtTokenByUserId` fetches the stored token for server-side validation in the auth middleware.
- **New:** `getPasswordHashByUserId` retrieves only the password hash for verification during password changes.
- **New:** `updatePasswordHash` writes the new bcrypt hash after a password change.
- `getStatusByName` supports signup; `getStatusById` supports login.
- `checkResearcherRole` and `checkVenueUserRole` are how login decides whether the account should be labeled `researcher`, `venue_user`, or plain `user`.

## 8. Login Controller (with Rate Limiting and Validation)

### `backend/src/controllers/userController.js`

```js
login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "email and password are required." });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    // Rate limiting check
    const clientIp = req.ip || req.connection.remoteAddress;
    const rateCheck = checkRateLimit(clientIp);
    if (rateCheck.blocked) {
      return res.status(429).json({
        error: `Too many failed login attempts. Please try again in ${rateCheck.retryAfter} seconds.`,
      });
    }

    const user = await this.userModel.getUserByEmail(email);
    if (!user) {
      recordFailedLogin(clientIp);
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const status = await this.userModel.getStatusById(user.status_id);
    if (!status || status.status_name.toLowerCase() !== "active") {
      return res.status(403).json({
        error: "Your account is not active. Please contact support.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      recordFailedLogin(clientIp);
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Clear failed login attempts on successful auth
    clearFailedLogins(clientIp);

    let role = "user";
    const researcher = await this.userModel.checkResearcherRole(user.id);
    if (researcher) {
      role = "researcher";
    } else {
      const venueUser = await this.userModel.checkVenueUserRole(user.id);
      if (venueUser) {
        role = "venue_user";
      }
    }

    const token = jwt.sign({ userId: user.id, role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    await this.userModel.updateJwtToken(user.id, token);

    return res.status(200).json({ token, role, userId: user.id });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
};
```

Explanation:

- Login requires both `email` and `password`.
- **New:** Email format is validated before any database query.
- **New:** Rate limiting is checked before credentials are processed. If the IP has 5+ failed attempts within 15 minutes, a 429 response is returned with the retry-after time.
- It fetches the user row from the database by email.
- It blocks inactive users by checking the `status` table.
- `bcrypt.compare` checks the submitted password against the stored `password_hash`.
- **New:** Failed login attempts (wrong email or wrong password) are recorded for rate limiting against the client IP.
- **New:** On successful login, the failed-attempts counter is cleared.
- Role detection is ordered: `researcher`, then `venue_user`, otherwise `user`.
- A new JWT is issued on every successful login and saved in the database.

## 9. Logout Controller

### `backend/src/controllers/userController.js`

```js
logout = async (req, res) => {
  try {
    const userId = req.auth.userId;

    await this.userModel.clearJwtToken(userId);

    return res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("[logout]", error.message);
    return res.status(500).json({ error: "Internal server error." });
  }
};
```

Explanation:

- This endpoint requires authentication (not in `publicRoutes`).
- `req.auth.userId` is set by the auth middleware after token validation.
- It calls `clearJwtToken` to set `jwt_token = NULL` in the database.
- Because the auth middleware now compares the presented token against the stored one, any subsequent request with the old token will fail with 401 "Token has been revoked."
- This provides proper server-side session invalidation.

## 10. Change Password Controller

### `backend/src/controllers/userController.js`

```js
changePassword = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        error: "current_password and new_password are required.",
      });
    }

    if (!validatePassword(new_password)) {
      return res.status(400).json({
        error: "New password must be at least 8 characters long.",
      });
    }

    // Verify current password
    const record = await this.userModel.getPasswordHashByUserId(userId);
    if (!record) {
      return res.status(404).json({ error: "User not found." });
    }

    const match = await bcrypt.compare(current_password, record.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    // Hash new password and update
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const newHash = await bcrypt.hash(new_password, saltRounds);
    await this.userModel.updatePasswordHash(userId, newHash);

    // Revoke current session so user must re-authenticate with new password
    await this.userModel.clearJwtToken(userId);

    return res.status(200).json({
      message:
        "Password changed successfully. Please log in again with your new password.",
    });
  } catch (error) {
    console.error("[changePassword]", error.message);
    return res.status(500).json({ error: "Internal server error." });
  }
};
```

Explanation:

- This endpoint requires authentication (not in `publicRoutes`).
- The user must provide `current_password` to prove their identity, plus `new_password`.
- The new password is validated for minimum length (8 characters).
- `bcrypt.compare` verifies the current password against the stored hash.
- The new password is hashed with bcrypt and saved via `updatePasswordHash`.
- After the password is changed, `clearJwtToken` invalidates the current session. This forces the user to log in again with the new password, which is a security best practice.

## 11. Researcher Signup Routes

### `backend/src/routes/authorRoutes.js`

```js
this.router.get("/lookup/orc-id", this.authorController.lookupByOrcId);
this.router.get("/lookup/name", this.authorController.lookupByName);

this.router.get("/", this.authorController.getAllAuthors);
this.router.get("/:id/papers", this.authorController.getPapersByAuthor);
```

### `backend/src/routes/researcherRoutes.js`

```js
this.router.post("/", this.researcherController.createResearcher);
```

Explanation:

- Researcher signup has two discovery parts and one final creation part.
- Author lookup can happen through dedicated `/lookup/...` routes or through query-parameter handling inside `getAllAuthors`.
- The actual account creation happens at `POST /api/researchers`.

## 12. Researcher Signup Lookup Controller

### `backend/src/controllers/authorController.js`

```js
getAllAuthors = async (req, res) => {
  try {
    const { orc_id, name } = req.query;

    if (orc_id) {
      const author = await this.authorModel.getAuthorByOrcId(orc_id);
      if (!author) {
        return res
          .status(404)
          .json({ error: "No author found with this ORCID." });
      }
      const claimed = await this.authorModel.isAuthorClaimed(author.id);
      if (claimed) {
        return res.status(409).json({
          error:
            "This ORCID is already associated with an account. Please contact support.",
        });
      }
      return res
        .status(200)
        .json({ id: author.id, name: author.name, orc_id: author.orc_id });
    }

    if (name) {
      const authors = await this.authorModel.getAuthorsByName(name);
      if (authors.length === 0) {
        return res
          .status(404)
          .json({ error: "No authors found with this name." });
      }
      const formatted = authors.map((a) => ({
        id: a.id,
        name: a.name,
        orc_id: a.orc_id,
        latest_paper: a.paper_id
          ? { id: a.paper_id, title: a.paper_title }
          : null,
      }));
      return res.status(200).json(formatted);
    }

    const authors = await this.authorModel.getAllAuthors();
    return res
      .status(200)
      .json({ success: true, count: authors.length, data: authors });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};
```

Explanation:

- `?orc_id=` performs exact lookup by ORCID and then checks whether that author is already claimed.
- `?name=` performs a broader search and returns the latest paper for each matching author.
- If neither query param is present, the method falls back to normal author listing.

## 13. Researcher Signup Lookup Model

### `backend/src/models/authorModel.js`

```js
getAuthorByOrcId = async (orcId) => {
  const query = `
          SELECT id, name, orc_id
          FROM author
          WHERE orc_id = $1;
      `;

  const result = await this.db.query_executor(query, [orcId]);
  return result.rows[0] || null;
};

isAuthorClaimed = async (authorId) => {
  const query = `SELECT user_id FROM researcher WHERE author_id = $1;`;
  const result = await this.db.query_executor(query, [authorId]);
  return result.rows[0] || null;
};

getAuthorsByName = async (name) => {
  const query = `
          SELECT
              a.id,
              a.name,
              a.orc_id,
              sample.paper_id,
              sample.paper_title
          FROM author a
          LEFT JOIN LATERAL (
              SELECT
                  p.id   AS paper_id,
                  p.title AS paper_title
              FROM paper_author pa
              JOIN paper p ON p.id = pa.paper_id
              WHERE pa.author_id = a.id
              ORDER BY p.publication_date DESC
              LIMIT 1
          ) sample ON true
          WHERE a.name ILIKE '%' || $1 || '%'
          ORDER BY a.name;
      `;

  const result = await this.db.query_executor(query, [name]);
  return result.rows;
};
```

Explanation:

- `getAuthorByOrcId` is the exact-match database query for ORCID.
- `isAuthorClaimed` checks whether a row already exists in `researcher` for that `author_id`.
- `getAuthorsByName` uses `ILIKE` for case-insensitive search.
- The `LEFT JOIN LATERAL` subquery fetches each author's most recent paper.

## 14. Researcher Signup Creation Controller

### `backend/src/controllers/researcherController.js`

```js
const ResearcherModel = require("../models/researcherModel.js");
const UserModel = require("../models/userModel.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

class ResearcherController {
  constructor() {
    this.researcherModel = new ResearcherModel();
    this.userModel = new UserModel();
  }

  createResearcher = async (req, res) => {
    try {
      const {
        full_name,
        username,
        email,
        password,
        phone_number,
        bio,
        author_id,
      } = req.body;

      if (!full_name || !username || !email || !password || !author_id) {
        return res.status(400).json({
          error:
            "full_name, username, email, password, and author_id are required.",
        });
      }

      const status = await this.userModel.getStatusByName("active");
      if (!status) {
        return res
          .status(500)
          .json({ error: "Could not resolve active status." });
      }

      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      const user = await this.researcherModel.signupResearcher({
        username,
        full_name,
        email,
        password_hash,
        phone_number: phone_number || null,
        status_id: status.id,
        bio: bio || null,
        author_id: Number(author_id),
      });

      const token = jwt.sign(
        { userId: user.id, role: "researcher" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      await this.userModel.updateJwtToken(user.id, token);

      return res
        .status(201)
        .json({ token, role: "researcher", userId: user.id });
    } catch (error) {
      if (error.code === "23505") {
        if (error.detail && error.detail.includes("email")) {
          return res.status(409).json({ error: "Email already in use." });
        }
        if (error.detail && error.detail.includes("username")) {
          return res.status(409).json({ error: "Username already taken." });
        }
        if (error.detail && error.detail.includes("author_id")) {
          return res
            .status(409)
            .json({ error: "This author profile has already been claimed." });
        }
      }
      return res.status(500).json({ error: "Internal server error." });
    }
  };
}
```

Explanation:

- This is the final researcher signup endpoint.
- It validates the account fields plus `author_id`.
- It hashes the password just like regular signup.
- It delegates the actual user-plus-researcher insert to a transactional model method.
- It returns a researcher-scoped JWT and stores it in the database.

## 15. Researcher Signup Transaction Model

### `backend/src/models/researcherModel.js`

```js
signupResearcher = async (payload) => {
  const client = await this.db.pool.connect();
  try {
    await client.query("BEGIN");

    const userQuery = `
              INSERT INTO "user"
                  (username, full_name, email, password_hash, phone_number, status_id, bio)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id, username, full_name, email;
          `;
    const userResult = await client.query(userQuery, [
      payload.username,
      payload.full_name,
      payload.email,
      payload.password_hash,
      payload.phone_number || null,
      payload.status_id,
      payload.bio || null,
    ]);
    const user = userResult.rows[0];

    const researcherQuery = `
              INSERT INTO researcher (user_id, author_id)
              VALUES ($1, $2)
              RETURNING user_id, author_id;
          `;
    await client.query(researcherQuery, [user.id, payload.author_id]);

    await client.query("COMMIT");
    return user;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
```

Explanation:

- This method guarantees that both inserts succeed together.
- If the user insert works but the researcher insert fails, the rollback removes the partial work.
- That protects the database from orphaned user rows.

## 16. Venue User Signup Routes

### `backend/src/routes/venueRoutes.js`

```js
this.#router.get("/lookup/issn", this.#controller.lookupByIssn);
this.#router.get("/lookup/name", this.#controller.lookupByName);

this.#router.get("/", this.#controller.getAllVenues);
```

### `backend/src/routes/venueUserRoutes.js`

```js
this.#router.post("/", this.#controller.createVenueUser);
```

Explanation:

- Venue signup uses venue lookup endpoints first, then `POST /api/venue-users` for final account creation.
- As with authors, the current code also supports query-parameter logic through the main `getAllVenues` handler.

## 17. Venue Signup Lookup Controller

### `backend/src/controllers/venueController.js`

```js
getAllVenues = async (req, res) => {
  try {
    const { issn, name } = req.query;

    if (issn) {
      const venue = await this.venueModel.getVenueByIssn(issn);
      if (!venue) {
        return res
          .status(404)
          .json({ error: "No venue found with this ISSN." });
      }
      const claimed = await this.venueModel.isVenueClaimed(venue.id);
      if (claimed) {
        return res.status(409).json({
          error:
            "This venue already has an account. Please contact support if you believe this is an error.",
        });
      }
      return res.status(200).json({
        id: venue.id,
        name: venue.name,
        issn: venue.issn,
        publisher: { id: venue.publisher_id, name: venue.publisher_name },
      });
    }

    if (name) {
      const venues = await this.venueModel.getVenuesByNameWithClaimed(name);
      if (venues.length === 0) {
        return res
          .status(404)
          .json({ error: "No venues found with this name." });
      }
      const formatted = venues.map((v) => ({
        id: v.id,
        name: v.name,
        issn: v.issn,
        is_claimed: v.is_claimed,
        publisher: { id: v.publisher_id, name: v.publisher_name },
      }));
      return res.status(200).json(formatted);
    }

    const venues = await this.venueModel.getAllVenues();
    return res.status(200).json(venues);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
};
```

Explanation:

- `?issn=` performs an exact lookup and blocks already-claimed venues.
- `?name=` performs a broader search and returns an `is_claimed` flag.
- If no query parameter is supplied, it falls back to the generic venue listing.

## 18. Venue Signup Lookup Model

### `backend/src/models/venueModel.js`

```js
getVenueByIssn = async (issn) => {
  const query = `
          SELECT
              v.*,
              p.name       AS publisher_name,
              p.country    AS publisher_country,
              p.website    AS publisher_website
          FROM venue v
          LEFT JOIN publisher p ON p.id = v.publisher_id
          WHERE v.issn = $1;
      `;

  const result = await this.db.query_executor(query, [issn]);
  return result.rows[0] || null;
};

isVenueClaimed = async (venueId) => {
  const query = `SELECT user_id FROM venue_user WHERE venue_id = $1;`;
  const result = await this.db.query_executor(query, [venueId]);
  return result.rows[0] || null;
};

getVenuesByNameWithClaimed = async (name) => {
  const query = `
          SELECT
              v.id,
              v.name,
              v.issn,
              v.type,
              p.id   AS publisher_id,
              p.name AS publisher_name,
              CASE WHEN vu.user_id IS NOT NULL THEN true ELSE false END AS is_claimed
          FROM venue v
          JOIN publisher p ON p.id = v.publisher_id
          LEFT JOIN venue_user vu ON vu.venue_id = v.id
          WHERE v.name ILIKE '%' || $1 || '%'
          ORDER BY v.name;
      `;

  const result = await this.db.query_executor(query, [name]);
  return result.rows;
};
```

Explanation:

- `getVenueByIssn` joins venue data with publisher data.
- `isVenueClaimed` checks whether `venue_user` already contains that venue.
- `getVenuesByNameWithClaimed` combines fuzzy search with claim status in a single result set.

## 19. Venue User Signup Creation Controller

### `backend/src/controllers/venueUserController.js`

```js
const VenueUserModel = require("../models/venueUserModel.js");
const UserModel = require("../models/userModel.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

class VenueUserController {
  constructor() {
    this.venueUserModel = new VenueUserModel();
    this.userModel = new UserModel();
  }

  createVenueUser = async (req, res) => {
    try {
      const {
        full_name,
        username,
        email,
        password,
        phone_number,
        bio,
        venue_id,
      } = req.body;

      if (!full_name || !username || !email || !password || !venue_id) {
        return res.status(400).json({
          error:
            "full_name, username, email, password, and venue_id are required.",
        });
      }

      const status = await this.userModel.getStatusByName("active");
      if (!status) {
        return res
          .status(500)
          .json({ error: "Could not resolve active status." });
      }

      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      const user = await this.venueUserModel.signupVenueUser({
        username,
        full_name,
        email,
        password_hash,
        phone_number: phone_number || null,
        status_id: status.id,
        bio: bio || null,
        venue_id: Number(venue_id),
      });

      const token = jwt.sign(
        { userId: user.id, role: "venue_user" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      await this.userModel.updateJwtToken(user.id, token);

      return res
        .status(201)
        .json({ token, role: "venue_user", userId: user.id });
    } catch (error) {
      if (error.code === "23505") {
        if (error.detail && error.detail.includes("email")) {
          return res.status(409).json({ error: "Email already in use." });
        }
        if (error.detail && error.detail.includes("username")) {
          return res.status(409).json({ error: "Username already taken." });
        }
        if (error.detail && error.detail.includes("venue_id")) {
          return res
            .status(409)
            .json({ error: "This venue has already been claimed." });
        }
      }
      return res.status(500).json({ error: "Internal server error." });
    }
  };
}
```

Explanation:

- This is the final signup step for a venue account holder.
- It has the same structure as researcher signup, but binds the user row to `venue_user` instead of `researcher`.
- The JWT payload role is `venue_user`.

## 20. Venue User Signup Transaction Model

### `backend/src/models/venueUserModel.js`

```js
signupVenueUser = async (payload) => {
  const client = await this.db.pool.connect();
  try {
    await client.query("BEGIN");

    const userQuery = `
              INSERT INTO "user"
                  (username, full_name, email, password_hash, phone_number, status_id, bio)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id, username, full_name, email;
          `;
    const userResult = await client.query(userQuery, [
      payload.username,
      payload.full_name,
      payload.email,
      payload.password_hash,
      payload.phone_number || null,
      payload.status_id,
      payload.bio || null,
    ]);
    const user = userResult.rows[0];

    const venueUserQuery = `
              INSERT INTO venue_user (user_id, venue_id)
              VALUES ($1, $2)
              RETURNING user_id, venue_id;
          `;
    await client.query(venueUserQuery, [user.id, payload.venue_id]);

    await client.query("COMMIT");
    return user;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
```

Explanation:

- This transaction ensures `user` and `venue_user` stay consistent.
- If the venue is already claimed or another database constraint fails, the whole transaction is rolled back.

## 21. Summary of All Implemented Auth Paths

Regular user signup:

1. `POST /api/users`
2. `UserController.createUser`
3. Validate username, email, password format
4. `UserModel.getStatusByName`
5. `bcrypt.hash`
6. `UserModel.createUser`
7. `jwt.sign`
8. `UserModel.updateJwtToken`

Researcher signup:

1. `GET /api/authors?orc_id=...` or `GET /api/authors?name=...`
2. `AuthorController.getAllAuthors`
3. `AuthorModel.getAuthorByOrcId` or `AuthorModel.getAuthorsByName`
4. `AuthorModel.isAuthorClaimed`
5. `POST /api/researchers`
6. `ResearcherController.createResearcher`
7. `ResearcherModel.signupResearcher`
8. `jwt.sign`
9. `UserModel.updateJwtToken`

Venue user signup:

1. `GET /api/venues?issn=...` or `GET /api/venues?name=...`
2. `VenueController.getAllVenues`
3. `VenueModel.getVenueByIssn` or `VenueModel.getVenuesByNameWithClaimed`
4. `VenueModel.isVenueClaimed`
5. `POST /api/venue-users`
6. `VenueUserController.createVenueUser`
7. `VenueUserModel.signupVenueUser`
8. `jwt.sign`
9. `UserModel.updateJwtToken`

Login (with rate limiting):

1. `POST /api/users/login`
2. `UserController.login`
3. `validateEmail` — format check
4. `checkRateLimit` — brute-force protection
5. `UserModel.getUserByEmail`
6. `UserModel.getStatusById`
7. `bcrypt.compare`
8. `clearFailedLogins` — on success
9. `UserModel.checkResearcherRole` and `UserModel.checkVenueUserRole`
10. `jwt.sign`
11. `UserModel.updateJwtToken`

Logout:

1. `POST /api/users/logout` (requires valid token)
2. `authenticateToken` middleware verifies JWT and checks DB match
3. `UserController.logout`
4. `UserModel.clearJwtToken` — sets `jwt_token = NULL`
5. Subsequent requests with the old token are rejected by middleware

Change password:

1. `POST /api/users/change-password` (requires valid token)
2. `authenticateToken` middleware verifies JWT and checks DB match
3. `UserController.changePassword`
4. `UserModel.getPasswordHashByUserId`
5. `bcrypt.compare` — verify current password
6. `bcrypt.hash` — hash new password
7. `UserModel.updatePasswordHash`
8. `UserModel.clearJwtToken` — forces re-login

Token verification on every protected request:

1. `authenticateToken` middleware runs
2. `jwt.verify` — cryptographic validation
3. `UserModel.getUserById` — user existence check
4. `UserModel.getJwtTokenByUserId` — server-side token match
5. If match fails → 401 "Token has been revoked"
