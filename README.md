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

> Run `prisma generate` after schema changes. Use `prisma migrate dev` only
> for local development databases; production deployments use the migration
> procedure described below.

### 5. Seed the first admin account + starter data

Registration only ever creates STUDENT or MENTOR accounts (by design —
see the locked Phase 0 decisions), so the first ADMIN account, the Green
University / ADS department rows, and the default email templates come
from the seed script:

```bash
npm run db:seed
```

Seed users are created only when their corresponding `SEED_*` variables
are explicitly configured. Admin requires `SEED_ADMIN_ID`,
`SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD`; moderator requires
`SEED_MODERATOR_ID`, `SEED_MODERATOR_EMAIL`, and
`SEED_MODERATOR_PASSWORD`; mentor additionally requires
`SEED_MENTOR_NAME`. Existing seed users are left unchanged.

### 6. Run the dev server

```bash
npm run dev
```

Visit `http://localhost:3000`. Try registering as a student (goes
straight to email verification → active) and as a mentor (verification →
`PENDING_APPROVAL`, held at `/pending-approval` since the approve/reject
screens are a later phase).

## Environment variables

See `.env.example` for variable names. In Vercel, configure
`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `APP_URL`
under Project Settings → Environment Variables. Configure `COMMUNICATION_CRON_SECRET`
when the communication scheduler is enabled. For email delivery, configure
`EMAIL_PROVIDER` and `EMAIL_FROM_ADDRESS`, plus `RESEND_API_KEY` for Resend or
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD` for SMTP. Keep these
values server-side and never use `NEXT_PUBLIC_` prefixes. Seed variables are
needed only when intentionally creating seed accounts. Never commit `.env` —
it's covered by `.gitignore`.

## Phase 6 communication scheduler

Apply the Phase 6 Prisma migration before running the application. Configure
`COMMUNICATION_CRON_SECRET` and schedule an external job to send a `POST` to
`/api/cron/communication` with `Authorization: Bearer <secret>` at least once
every 15 minutes. The endpoint publishes due notices and sends reminders for
scheduled `AttendanceSession` records within 24 hours of their start time.
Configure `APP_URL` and the email provider for links and delivery. Repeated
dispatches are deduplicated through `EmailLog`; failed delivery attempts are
recorded and may be retried by a later run.

### Phase 7 security migration

For production, take/confirm a Neon restore point before schema changes and
verify recovery on an isolated Neon branch according to the project’s Neon
plan and retention policy. Review pending SQL, then use the direct (non-pooled)
Neon connection for:

```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate status
```

Do not use `prisma db push`, `migrate reset`, or `prisma seed` for production
deployments. Existing databases that predate Prisma migration tracking must
have their already-present migrations baselined with `migrate resolve --applied`
only after read-only schema comparison; never baseline a migration whose schema
changes are absent. The Phase 7 migration adds per-user refresh-token versions
and a shared PostgreSQL rate-limit table for use across Vercel instances.

Deploy the application only after the migration succeeds and required server
environment variables are present in Vercel Project Settings. Vercel builds
generate the Prisma client through `postinstall`. Configure the external
communication scheduler to `POST /api/cron/communication` with
`Authorization: Bearer <COMMUNICATION_CRON_SECRET>` at least every 15 minutes.
For delivery, use `EMAIL_PROVIDER=smtp` with the SMTP variables or
`EMAIL_PROVIDER=resend` with `RESEND_API_KEY`; configure `EMAIL_FROM_ADDRESS`
and `APP_URL` in either case.

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
  (`SEED_MODERATOR_ID`). An "admin manages
  moderators" UI is a later-phase addition.
- The mentor approval workflow (admin: any department in their university; moderator:
  own-department only; approve/reject with mandatory reason on reject;
  audit log; approval/rejection email) is implemented — see the phase
  summary for the full authorization walkthrough.
- "View mentor details" is currently inline on the pending-mentors list
  (ID, email, department, registration date) rather than a separate
  detail page — flag if you want a dedicated `/mentors/[id]` view.
