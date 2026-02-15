# OTP Authenticator

A self-hosted web-based TOTP authenticator. Solves the problem of losing your 2FA codes when switching phones by keeping your secrets safely on your own server.

## Features

- Live 6/8-digit TOTP codes with countdown timer
- Add accounts via camera QR scan, image upload, or manual entry
- AES-256-GCM encrypted storage (secrets never stored in plaintext)
- Encrypted export for backup / migration between devices
- Username + password login with JWT session management
- Single Docker container — easy to deploy on Unraid

---

## Quick start

### 1. Generate secrets

```bash
# Run this three times to get three unique secrets
openssl rand -base64 48
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Edit `.env` and fill in your generated secrets:

```dotenv
ENCRYPTION_KEY=<your_first_secret>
JWT_SECRET=<your_second_secret>
JWT_REFRESH_SECRET=<your_third_secret>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
PORT=3001
TRUST_PROXY=1
```

### 3. Build and run

```bash
docker compose up -d --build
```

Open `http://your-server-ip:3001` and log in with your admin credentials.

---

## Unraid setup

1. Install the **Community Applications** plugin if you haven't already
2. Copy this repo to your Unraid server (or clone it)
3. In Unraid, go to **Docker > Add Container** and set:
   - **Repository**: Build from the Dockerfile (or push to Docker Hub first)
   - **Port mapping**: `3001:3000`
   - **Volume mapping**: `/mnt/user/appdata/otp-authenticator:/data`
   - **Environment variables**: Set all vars from `.env.example`
4. Or use `docker compose up -d` via Unraid's terminal

### Behind Nginx Proxy Manager (recommended)

Add a proxy host pointing to `http://your-unraid-ip:3001`. Enable SSL with Let's Encrypt for secure remote access.

Set `TRUST_PROXY=1` in your env (already the default) so rate limiting uses real client IPs.

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENCRYPTION_KEY` | Yes | — | Min 32 chars. Used to encrypt TOTP secrets at rest. |
| `JWT_SECRET` | Yes | — | Min 32 chars. Signs access tokens. |
| `JWT_REFRESH_SECRET` | Yes | — | Min 32 chars. Signs refresh tokens. |
| `ADMIN_USERNAME` | No | `admin` | Username for the initial admin account. |
| `ADMIN_PASSWORD` | No | — | Password for the initial admin account. Only applied on first run (empty DB). |
| `PORT` | No | `3000` | Port the server listens on inside the container. |
| `TRUST_PROXY` | No | `0` | Set to `1` when behind a reverse proxy. |
| `LOG_LEVEL` | No | `info` | `trace` / `debug` / `info` / `warn` / `error` |
| `DB_PATH` | No | `/data/otp.db` | Path to the SQLite database file. |

---

## Backup and restore

The entire state of the app is in a single SQLite file at `/data/otp.db` (mapped to your volume).

**Backup:**
```bash
cp /mnt/user/appdata/otp-authenticator/otp.db otp.db.backup
```

**Restore:** Stop the container, replace the file, start again.

**Export from the UI:** Use the export feature (menu in top-right) to download an encrypted JSON backup. This can be imported back into any OTP Authenticator instance.

---

## Key rotation

If you need to change your `ENCRYPTION_KEY`:

1. Export your accounts from the UI (encrypted or plain format)
2. Stop the container
3. Update `ENCRYPTION_KEY` in your `.env`
4. Start the container — the DB will be empty (or delete the old DB)
5. Import your accounts back via the UI

---

## Security notes

- TOTP secrets are encrypted with AES-256-GCM using a key derived from `ENCRYPTION_KEY` via PBKDF2 (100,000 iterations)
- Passwords are hashed with bcrypt (cost factor 12)
- Access tokens expire after 15 minutes; refresh tokens after 7 days
- Login is rate-limited to 5 attempts per 15 minutes per IP
- The Docker container runs as a non-root user

---

## Development

### Prerequisites

- Node.js 22+
- npm 10+

### Start dev servers

```bash
# Backend (watches for changes)
npm run dev:backend

# Frontend (Vite HMR)
npm run dev:frontend
```

The frontend dev server proxies `/api` requests to `http://localhost:3000`.

### Run tests

```bash
cd backend && npm test
```

### Build for production

```bash
npm run build
```
