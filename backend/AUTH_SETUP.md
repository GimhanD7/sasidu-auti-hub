# Login and password reset

Copy `.env.example` to `.env` and set `MONGO_URI`. `FRONTEND_URL` must match the browser's frontend origin exactly (default: `http://localhost:5173`). Set the frontend's `VITE_API_URL` if the backend is not at `http://localhost:5000`.

Start the backend with `npm run dev` and the frontend with `npm run dev` in their respective directories.

## Sessions

Login creates a random server-side session. The browser receives an HTTP-only, SameSite=Lax cookie; session secrets are stored as SHA-256 hashes in MongoDB. Regular sessions expire after 24 hours on the server, and their cookies last for the browser session. Remember-device sessions and cookies last 30 days. Browsers may restore session cookies when restoring windows, so the server expiry is authoritative.

In production, set `NODE_ENV=production`, use HTTPS, and keep the frontend and API on the same site (for example, `app.example.com` and `api.example.com`). The cookie becomes Secure in production. A different-site deployment requires a separate cookie/CSRF configuration.

Logout deletes the current session from the database and clears its cookie. Password reset increments the account session version, invalidating all previous sessions. Session TTL cleanup is asynchronous; each authenticated request also checks expiry and session version.

Apply `requireAuth` and `requireRole` from `middleware/auth.js` when adding subsequent protected backend routes. Current frontend portal routes require a matching role, and `/api/auth/me` validates the account and session on the server.

## Password reset email

Set `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`, and `FRONTEND_URL`. Set `SMTP_USER` and `SMTP_PASSWORD` when the provider requires authentication. Port 465 uses implicit TLS; other ports use STARTTLS, which is required in production. See [Nodemailer SMTP configuration](https://nodemailer.com/smtp).

If SMTP is not configured, password-reset requests return an availability error. Reset links are never returned by the API or printed to logs. When mail delivery fails, the pending token is removed and the server logs a configuration message. The public response stays the same for existing and unknown accounts.

Reset links expire after 30 minutes and can be consumed once. The password is hashed with bcrypt; reset tokens are generated with [Node's cryptographic random bytes](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback) and stored as hashes. Passwords require at least 8 characters and at most 72 UTF-8 bytes.

Authentication and reset requests are rate-limited by IP within each server process. Deployments with multiple instances need a shared rate-limit store. If running behind a proxy, configure Express `trust proxy` for that specific infrastructure so IP limits use the correct address; do not enable it indiscriminately.

## Verification

`npm test` in the backend checks actual HTTP routes with in-memory database and email substitutes. It covers credentials, cookie options, active accounts, expiry, role checks, logout, reset-token expiry and reuse, previous-session invalidation, and request throttling. `npm test` in the frontend checks role redirects. `npm run build` and `npm run lint` verify the frontend.

Live MongoDB persistence and delivery through a real SMTP provider require verification after environment configuration. Automated tests never send real email.
