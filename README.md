# Mentor Management System

University Mentoring & Student Management Platform — Phase 1 (Foundation).

Built for the Artificial Intelligence and Data Science (ADS) Department of
Green University of Bangladesh, architected to support additional
departments later without redesigning the core schema.

## Phase 1 scope

This phase covers project setup and the authentication foundation only:
student/mentor registration, email verification, the mentor
approval-pending status, login, logout, token refresh, forgot/reset
password, role-aware routing, and a placeholder dashboard per role.
Attendance, batches, performance, notices, XLSX import, and the actual
mentor-approval admin/moderator UI are built in later phases.

## Tech stack

Next.js (App Router) + TypeScript, Tailwind CSS v4, hand-built
shadcn/ui-style components, PostgreSQL + Prisma, JWT auth via HTTP-only
cookies, a provider-agnostic email layer (console-log in dev, Resend when
configured).

## Running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Set up a Postgres database

The free tier of [Neon](https://neon.tech) or
[Supabase](https://supabase.com) both work well. Copy the connection
string it gives you.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` with your connection string, and generate two
random secrets for `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`:

```bash
openssl rand -base64 48
```

For development, set `EMAIL_PROVIDER=smtp` and configure Gmail SMTP using
an app password (never your normal Gmail password). Set `SMTP_HOST` to
`smtp.gmail.com`, `SMTP_PORT` to `465`, `SMTP_USER` to the Gmail address,
`SMTP_PASSWORD` to its app password, and `EMAIL_FROM_ADDRESS` to that
sender address. Keep the credentials only in `.env`.

`EMAIL_PROVIDER=console` is safe for local form-flow checks but does not
deliver messages; registration logs a failed email attempt. To use Resend,
set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM_ADDRESS` to
a sender address on a domain verified with Resend. The existing Resend
adapter remains available for production.

Registration requires a personal email for verification and password
recovery. University email is optional and stored separately from that
verification address. `APP_URL` should be the app origin used in generated
verification and password-reset links.

### 4. Generate the Prisma client and run the migration

```bash
npx prisma generate
npx prisma migrate dev --name init
```

> **Note:** this schema was written and reviewed in a sandboxed
> environment without network access to Prisma's binary mirror, so
> `prisma generate`/`migrate` could not be executed there. Run these two
> commands yourself the first time you set the project up locally — they
> only need to succeed once per environment.

### 5. Seed the first admin account + starter data

Registration only ever creates STUDENT or MENTOR accounts (by design —
see the locked Phase 0 decisions), so the first ADMIN account, the Green
University / ADS department rows, and the default email templates come
from the seed script:

```bash
npm run db:seed
```

By default this creates an admin with ID `admin-001` and password
`ChangeMe123!` — override via `SEED_ADMIN_ID` / `SEED_ADMIN_PASSWORD` /
`SEED_ADMIN_EMAIL` in `.env` before seeding. **Change or remove this
account before any real deployment.**

### 6. Run the dev server

```bash
npm run dev
```

Visit `http://localhost:3000`. Try registering as a student (goes
straight to email verification → active) and as a mentor (verification →
`PENDING_APPROVAL`, held at `/pending-approval` since the approve/reject
screens are a later phase).

## Environment variables

See `.env.example` for the full list with descriptions. Never commit
`.env` — it's already covered by `.gitignore`.

## Phase 6 communication scheduler

Apply the Phase 6 Prisma migration before running the application. Configure
`COMMUNICATION_CRON_SECRET` and schedule an external job to send a `POST` to
`/api/cron/communication` with `Authorization: Bearer <secret>` at least once
every 15 minutes. The endpoint publishes due notices and sends reminders for
scheduled `AttendanceSession` records within 24 hours of their start time.
Configure `APP_URL` and the email provider for links and delivery. Repeated
dispatches are deduplicated through `EmailLog`; failed delivery attempts are
recorded and may be retried by a later run.

## Project structure

```
prisma/schema.prisma       Full data model (all Phase 0 entities)
prisma/seed.ts              University/department/admin/email-template seed
src/app/(auth)/...          Login, register, forgot/reset password, verify-email
src/app/admin|mentor|moderator|student/dashboard  Role dashboards (Phase 1 placeholders)
src/app/pending-approval    Holding page for unapproved mentors
src/app/api/auth/...        Auth route handlers (register, login, logout, refresh, ...)
src/app/api/departments     Public department list (registration form)
src/app/api/me              Current-session user info
src/lib/auth/               Password hashing, JWT, cookies, session, guards, tokens
src/lib/email/              Provider-agnostic sender + DB-backed template rendering
src/lib/validation/         Zod schemas for auth request bodies
src/middleware.ts           Coarse route protection (real checks happen server-side)
src/components/ui/          Hand-built shadcn/ui-style primitives
```

## Known issues / decisions for review

- `prisma generate`/`migrate` were not run in the build environment (no
  network access to Prisma's engine binaries there) — run them yourself
  per step 4 above before first use.
- Moderator accounts (like admin) aren't created via public registration
  — the seed script creates a test moderator scoped to ADS
  (`SEED_MODERATOR_ID`, default `moderator-001`). An "admin manages
  moderators" UI is a later-phase addition.
- The mentor approval workflow (admin: any department; moderator:
  own-department only; approve/reject with mandatory reason on reject;
  audit log; approval/rejection email) is implemented — see the phase
  summary for the full authorization walkthrough.
- "View mentor details" is currently inline on the pending-mentors list
  (ID, email, department, registration date) rather than a separate
  detail page — flag if you want a dedicated `/mentors/[id]` view.
