# Golf Charity Subscription Platform

Full-stack web app for golf score tracking, monthly draw rewards, and charity contributions.

This project was built for the Digital Heroes internship selection assignment (PRD-based).

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MySQL
- Auth: JWT
- Email: SMTP (Resend supported)
- Payments: Provider abstraction with `cashfree` and `mock` modes

## Monorepo Structure

- `client/` React frontend
- `server/` Express API, SQL schema/seed, Vercel serverless config
- `PRD.txt` Assignment PRD reference

## Core Features

- Public, subscriber, and admin role flows
- Subscription lifecycle states (active, cancelled, lapsed)
- Score management with latest-5 rolling retention
- Draw simulation and publishing (random/algorithmic)
- Prize pool tiering and jackpot carryover
- Charity directory, profile pages, featured section
- Charity preference updates and independent donations
- Winner proof upload, admin verification, payout updates
- Admin dashboard for users, subscriptions, scores, draws, charities, winners, analytics
- Mobile responsive nav and UI
- Toast feedback popup (top-left, auto-hide)

## Payment Note

Because real gateway onboarding can require KYC/business verification, this project supports `mock` payment mode for assignment demos.

- `PAYMENT_PROVIDER=mock`: demo payment activation flow without external gateway account
- `PAYMENT_PROVIDER=cashfree`: ready for sandbox/live integration when credentials are available

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create/update `server/.env` (example values):

```dotenv
PORT=4000
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace_with_strong_secret

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=golf_charity

SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=your_resend_key
SMTP_FROM=onboarding@resend.dev

PAYMENT_PROVIDER=mock
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_API_VERSION=2023-08-01
CASHFREE_BASE_URL=https://sandbox.cashfree.com/pg
SERVER_PUBLIC_URL=http://localhost:4000
PAYMENT_SUCCESS_URL=http://localhost:5173/dashboard
PAYMENT_CANCEL_URL=http://localhost:5173/register
```

### 3. Initialize database

Run SQL files in MySQL:

- `server/sql/schema.sql`
- `server/sql/seed.sql`

### 4. Run apps

Backend:

```bash
npm run dev -w server
```

Frontend:

```bash
npm run dev -w client --host
```

Frontend URL: `http://localhost:5173`

## Seed/Test Accounts

Seed users are defined in `server/sql/seed.sql`.

Default password in seed: `Password@123`

Examples:

- Admin: `admin@golfcharity.test`
- Subscriber: `aarav.sharma@example.com`

## API Health Check

```bash
GET /api/health
```

Expected response:

```json
{"status":"ok","service":"golf-charity-server"}
```

## Deployment (Vercel)

Deploy as two separate Vercel projects from one repo.

### Backend project

- Root directory: `server`
- Uses serverless entry: `server/api/index.js`
- Config file: `server/vercel.json`

Set backend env vars in Vercel (DB, JWT, SMTP, payment, URLs).

### Frontend project

- Root directory: `client`
- Framework: Vite
- Set `VITE_API_URL=<backend-vercel-url>/api`

After frontend deploy, set backend `CLIENT_URL` to frontend URL and redeploy backend once.

## Known Production Consideration

`/uploads` on Vercel serverless is ephemeral. For persistent proof files, move uploads to object storage (S3/Cloudinary/Supabase Storage).

## Submission Note

This implementation follows PRD requirements, with payment demonstrated through provider abstraction and mock mode for internship-friendly testing when gateway onboarding is restricted.
