# University Mentoring & Management System

A role-based mentoring and academic management platform for organizing university departments, student batches, mentor assignments, mentoring sessions, attendance, evaluations, notices, and communication.

[![Next.js](https://img.shields.io/badge/Next.js-App_Router-black?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Styles-Tailwind_CSS-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/)
[![Security audited](https://img.shields.io/badge/Security_Audited-17%2F17_regression_tests-brightgreen)](#security-and-compliance)

## Developer

| | |
|---|---|
| **Developer** | MD. Jahidul Hasan Jisan |
| **Student ID** | 251035042 |
| **Department** | Department of Artificial Intelligence and Data Science |
| **Institution** | Green University of Bangladesh (GUB) |

## Overview

The University Mentoring & Management System provides a shared workspace for academic administrators, moderators, mentors, and students. It is designed to replace fragmented spreadsheets and manual follow-up with a permission-aware workflow for organizing academic groups and tracking mentoring activity.

The application supports university and department organization, batch creation and student/mentor assignments, mentor approval, mentoring-session scheduling, attendance, performance records, student feedback on mentors, notices, and notification preferences. Role-specific pages and server-side API handlers expose these workflows to authorized users.

The initial configuration is seeded for Green University of Bangladesh's Artificial Intelligence and Data Science department. The data model uses university and department relationships to support expansion while keeping access scoped to the caller's organization.

## Features by phase

The table groups the capabilities represented in the current codebase into nine delivery areas. It is a feature map, not a claim that every listed area has a dedicated UI workflow or that each phase is a separate release.

| Phase | Capability | Current coverage |
|---|---|---|
| **1 — Foundation and identity** | Student and mentor registration, email verification, login/logout, access-token refresh, password recovery, role-aware routing, and pending-approval state for mentors. | Implemented |
| **2 — Academic organization** | University and department records, department-scoped batches, batch lifecycle/status, and student/mentor batch assignments. | Schema and management APIs/pages |
| **3 — Mentor and CR administration** | Admin and moderator review of mentor applications; admin approval/rejection of student CR requests and direct appointment of existing students, with a three-CR batch cap. | Implemented; mentor authorization is organization-scoped and CR approvals are batch-scoped |
| **4 — Sessions and attendance** | Schedule mentoring sessions, record attendance, finalize records, and retain a reasoned edit history for corrections. | Schema, APIs, and session pages |
| **5 — Performance and feedback** | Record student performance in simple or category mode; capture student evaluations of mentoring sessions and mentors. | Schema and APIs/reports |
| **6 — Notices and communication** | Target notices to users, departments, batches, or all users; batch noticeboards; CR-authored announcements; notification preferences; email templates; queued delivery logs and scheduled reminders. | Implemented, with external scheduler configuration required for scheduled dispatch |
| **7 — Reporting and discovery** | Attendance and performance reports, mentor and student lookup, and role-specific dashboards. | Reporting/search APIs and role pages |
| **8 — Application experience** | Responsive Next.js interface, Tailwind styling, reusable UI primitives, and dashboard/session/batch workflows. | Implemented in the current application |
| **9 — Security hardening** | University/department authorization boundaries, safe same-origin redirects, HTTP-only token cookies, refresh-token version revocation, shared PostgreSQL rate limiting, Zod request validation, and generic error responses on the communication scheduler. | Implemented controls with automated regression tests; see [Security and compliance](#security-and-compliance) |

### Roles

| Role | Typical responsibilities |
|---|---|
| **Admin** | Manage academic resources and mentors within their university; review mentor and batch CR applications; inspect and moderate batch notices. |
| **Moderator** | Manage and review work within the moderator's assigned department. |
| **Mentor** | Work with assigned batches, manage mentoring sessions and attendance, and record student progress. |
| **Student** | View their own mentoring/batch information and sessions, provide session feedback, and read batch notices; approved CRs can publish notices for their assigned batch. |

Students can optionally apply as a batch CR during registration. Admins can also appoint an existing student by ID or email. Each batch is limited to three approved CRs. CRs can post pinned Markdown notices and links/attachments; optional email announcements are sent to active students assigned to that batch.

The server is authoritative for role and scope checks. Public registration accepts student or mentor roles; privileged admin and moderator accounts are provisioned intentionally rather than self-assigned by a client.

## Technology

| Area | Technology |
|---|---|
| Web application | Next.js App Router, React, TypeScript |
| Styling and UI | Tailwind CSS v4, reusable hand-built shadcn/ui-style primitives |
| Icons and visualization | Lucide React, Recharts |
| API | Next.js Route Handlers |
| Input validation | Zod |
| Database | PostgreSQL; configured for Neon-compatible connection strings |
| ORM and driver | Prisma ORM with the PostgreSQL adapter and `pg` |
| Authentication | Signed JWT access and refresh tokens in HTTP-only cookies |
| Email | Nodemailer/SMTP or Resend; console provider for local development |
| Hosting | Vercel-compatible Next.js deployment |

**Implementation note:** Framer Motion and Multer are not dependencies in the current `package.json`. The current application also does not document a file-upload pipeline or a dark/light theme switch; those should be treated as future additions rather than installed capabilities.

## Architecture

The Next.js application serves both the web UI and API. Route Handlers call shared server-side services and Prisma, with authorization checks enforcing identity, role, and organization scope before sensitive records are accessed. PostgreSQL persists both application data and shared rate-limit state, which is important when requests are served by multiple serverless instances.

```text
Browser
  ├── Next.js App Router pages and UI
  └── Next.js Route Handlers
        ├── Authentication, validation, and authorization
        ├── Domain services (mentors, batches, sessions, notices, reports)
        └── Prisma + PostgreSQL (Neon-compatible)

External email provider  <── communication services / scheduled route
External scheduler       ──> POST /api/cron/communication
```

### Data model

The Prisma schema is the source of truth for the relational model. Important entities include:

| Model | Purpose |
|---|---|
| `University`, `Department` | Organization hierarchy; departments belong to a university and carry department-level configuration such as the low-attendance threshold. |
| `User` | Shared identity, login identifier, role, account status, password hash, token version, and CR application/approval fields with a designated CR batch. |
| `StudentProfile`, `MentorProfile`, `ModeratorProfile` | Role-specific profile data, department membership, moderator scope, and mentor approval state. |
| `Batch`, `StudentBatch`, `MentorBatch` | Academic cohorts and many-to-many student/mentor assignments. |
| `AttendanceSession`, `AttendanceRecord`, `AttendanceEditLog` | Scheduled sessions, per-student attendance, and an auditable correction trail. |
| `PerformanceRecord`, `MentorEvaluation` | Student performance entries and student feedback about mentoring sessions. |
| `Schedule` | Batch-level mentoring schedule entries. |
| `Notice`, `BatchNotice`, `Notification`, `NotificationPreference` | Targeted notices, batch-specific CR announcements and attachments, user notifications, read state, and per-channel preferences. |
| `EmailTemplate`, `EmailLog` | Editable message templates and delivery/deduplication history. |
| `EmailVerificationToken`, `PasswordResetToken` | Hashed, expiring, single-use account-verification and password-reset tokens. |
| `AuditLog`, `SecurityRateLimit` | Recorded administrative changes and database-backed rate limiting. |
| `Remark` | Student/mentor remarks with resolution state and audit details. |

### Project layout

```text
prisma/
  migrations/                 Versioned database migrations
  schema.prisma               Relational data model
  seed.ts                     Green University/ADS and optional seed accounts
src/
  app/
    (auth)/                    Login, registration, verification, password recovery
    admin/                     Admin dashboards and management pages
    mentor/                    Mentor dashboards, batches, sessions
    moderator/                 Moderator dashboards and management pages
    student/                   Student pages and session workflows
    api/                       Authentication, management, reports, and cron routes
  components/ui/               Reusable UI primitives
  lib/auth/                    JWT, cookies, sessions, redirects, and guards
  lib/security/                Rate limiting and security helpers
  lib/services/                Application/domain services
  lib/validation/              Zod validation schemas
tests/
  security.test.ts             Security regression tests
```

## Getting started

### Prerequisites

- Node.js **20.9 or later** (required by the Next.js version in this repository)
- npm (the repository includes `package-lock.json`)
- A PostgreSQL database; a Neon PostgreSQL project is a supported option
- Git

### 1. Clone and install

```bash
git clone https://github.com/blithejisan/university-mentoring-platform.git
cd university-mentoring-platform
npm install
```

### 2. Configure local environment

Copy the example file:

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Set `DATABASE_URL` to the PostgreSQL connection string for your development database. For a serverless deployment, use the connection string appropriate for your Neon setup and runtime connection pattern. Generate distinct, high-entropy secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`; for example:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

Set `APP_URL` to the local app origin. Choose an email provider: `console` is useful for local development without delivery, while `smtp` and `resend` require provider credentials. For example:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
JWT_ACCESS_SECRET="replace-with-a-unique-random-secret"
JWT_REFRESH_SECRET="replace-with-a-different-unique-random-secret"
APP_URL="http://localhost:3000"

EMAIL_PROVIDER="console"
EMAIL_FROM_ADDRESS=""
# Optional: use Vercel Blob for persistent batch notice file attachments:
BLOB_READ_WRITE_TOKEN=""
# For scheduled notice publishing and reminder dispatch:
COMMUNICATION_CRON_SECRET="replace-with-a-unique-random-secret"
```

Do not commit `.env` or put server secrets in `NEXT_PUBLIC_*` variables.
In development, batch notice uploads can use the ignored `public/uploads/` directory when no Blob token is configured. Production uploads require `BLOB_READ_WRITE_TOKEN`; configure `APP_URL` or `NEXT_PUBLIC_APP_URL` to the deployed origin so uploaded-file links in email notifications resolve correctly.

### 3. Apply migrations

The repository includes versioned migrations. Generate the Prisma client and apply the migrations to your **development** database:

```bash
npx prisma generate
npx prisma migrate dev
```

`npm install` also runs Prisma generation through the `postinstall` script. Use `migrate dev` only against a local/development database; use `npx prisma migrate deploy` for production after reviewing the migrations and following your database backup/recovery process. Do not use `prisma db push`, `migrate reset`, or development seeding as a production deployment procedure.

### 4. Seed initial organization and optional accounts

Run the seed command to create the Green University of Bangladesh and ADS department rows and default email templates:

```bash
npm run db:seed
```

Seed accounts are optional. Configure a complete group of the corresponding `SEED_*` variables before running the command to create an admin, moderator, or mentor. The seed script leaves existing seed users unchanged. Never use sample or personal production credentials in source control.

### 5. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Student and mentor registrations require email verification; verified mentors also require approval before accessing mentor workflows.

## Environment variables

| Variable | Required | Description |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma's PostgreSQL adapter. |
| `JWT_ACCESS_SECRET` | Yes | Secret used to sign access tokens. |
| `JWT_REFRESH_SECRET` | Yes | Separate secret used to sign refresh tokens. |
| `APP_URL` | Recommended | Public application origin used to construct verification, reset, and notification links when `NEXT_PUBLIC_APP_URL` and Vercel's `VERCEL_URL` are not set. |
| `NEXT_PUBLIC_APP_URL` | Optional | Public application origin override used to construct links in notices and email notifications. |
| `BLOB_READ_WRITE_TOKEN` | For production uploads | Vercel Blob read/write token for durable batch notice attachments; development may use local disk without it. |
| `EMAIL_PROVIDER` | For email | `console`, `smtp`, or `resend`, depending on the intended delivery setup. |
| `EMAIL_FROM_ADDRESS` | For email delivery | Formatted sender configured with the chosen provider, including the friendly display name. |
| `SMTP_HOST`, `SMTP_PORT`, `EMAIL_USER`, `EMAIL_PASS` | For SMTP | SMTP connection and authentication settings. `SMTP_USER` and `SMTP_PASSWORD` remain supported as legacy aliases. |
| `RESEND_API_KEY` | For Resend | API key for the Resend provider. |
| `COMMUNICATION_CRON_SECRET` | For scheduler | Bearer secret required by `POST /api/cron/communication`. Keep this secret server-side. |
| `SEED_ADMIN_ID`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Optional | Complete set to seed an admin account. |
| `SEED_MODERATOR_ID`, `SEED_MODERATOR_EMAIL`, `SEED_MODERATOR_PASSWORD` | Optional | Complete set to seed a moderator account. |
| `SEED_MENTOR_ID`, `SEED_MENTOR_EMAIL`, `SEED_MENTOR_PASSWORD`, `SEED_MENTOR_NAME` | Optional | Complete set to seed a mentor account. |

Prisma CLI migrations use `DIRECT_URL` when configured and otherwise fall back to `DATABASE_URL`. The application runtime creates its `pg` pool from `DATABASE_URL`.

### Email and scheduled communication

To deliver email, choose `EMAIL_PROVIDER=smtp` and configure `SMTP_HOST`, `SMTP_PORT`, `EMAIL_USER`, and `EMAIL_PASS`, or choose `EMAIL_PROVIDER=resend` and configure `RESEND_API_KEY`. Set `EMAIL_FROM_ADDRESS` to a provider-authorized sender (for example, `"GUB ADS Department" <ads.department.gub@gmail.com>`) and `APP_URL` to the deployed origin. The SMTP sender also accepts the legacy `SMTP_USER` and `SMTP_PASSWORD` variable names.

When using scheduled notices and session reminders, configure `COMMUNICATION_CRON_SECRET` and arrange an external scheduler to send a `POST` request to `/api/cron/communication` at least every 15 minutes:

```http
POST /api/cron/communication
Authorization: Bearer <COMMUNICATION_CRON_SECRET>
```

The endpoint publishes due notices and dispatches reminders for upcoming sessions. Email logs and deduplication keys help avoid repeat deliveries. Without a configured secret and a scheduler, these scheduled dispatches will not run automatically.

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Run the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm run test:security` | Run the security regression suite. |
| `npm run db:generate` | Generate the Prisma client. |
| `npm run db:migrate` | Run `prisma migrate dev` for development databases. |
| `npm run db:seed` | Seed the organization, default templates, and optionally configured users. |
| `npm run db:studio` | Open Prisma Studio. |
| `npx prisma studio` | Open Prisma Studio directly. |

## Security and compliance

Security-sensitive operations are implemented on the server. Current controls include:

- Role-based access checks with university, department, batch, and user ownership boundaries where applicable.
- Mentor approval and assignment checks before mentor access to protected workflows.
- Access and refresh tokens stored in HTTP-only cookies; cookies are `Secure` in production and use `SameSite=Lax`.
- Per-user token versioning to invalidate superseded sessions, including logout and password-reset invalidation.
- PostgreSQL-backed rate-limit state shared between application instances.
- Safe same-origin redirect validation to prevent open redirects.
- Zod schemas for request validation, including registration and authentication payloads.
- Timing-safe bearer-secret comparison for the communication scheduler endpoint.
- Automated checks for organization isolation, access control, session invalidation, rate limiting, cron authorization, safe redirects, and notification filtering.

### Automated security test result

The focused security suite was run from this repository with `npm run test:security`:

```text
tests 17
pass  17
fail  0
```

This result describes the repository's automated regression tests only. It is not a claim of independent penetration testing, formal certification, or a guarantee that the application is free of vulnerabilities. Re-run the suite after security-related changes:

```bash
npm run test:security
```

## Production deployment

The application can be deployed to Vercel as a Next.js project. Before deploying:

1. Provision PostgreSQL and configure the production `DATABASE_URL`.
2. Review and apply checked-in migrations with `npx prisma migrate deploy` using the production deployment process.
3. Configure both JWT secrets, `APP_URL`, and email-provider settings in Vercel's server-side environment variables.
4. Configure `COMMUNICATION_CRON_SECRET` and an external scheduler if scheduled communication is required.
5. Configure optional seed variables only if intentionally provisioning seed accounts; avoid production seeding as a routine deploy step.
6. Run the security regression suite and production build in CI or before release.

Take a database restore point before production schema changes and verify your recovery procedure independently. Keep credentials out of logs, client bundles, and source control.

## Contributing

1. Create a branch for your change.
2. Keep authorization and validation in server-side code; do not rely on UI visibility to enforce permissions.
3. Add or update focused tests for behavioral or security changes.
4. Run `npm run lint`, `npm run test:security`, and `npm run build` as applicable before opening a pull request.

## License

No license is specified in this repository. Contact the project maintainer before reusing or redistributing the code.
