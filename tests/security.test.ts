import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { NextRequest } from "next/server";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/test";

let prisma: typeof import("../src/lib/prisma").prisma;
let guards: typeof import("../src/lib/auth/guards");
let sessions: typeof import("../src/lib/auth/session");
let approvals: typeof import("../src/lib/services/mentorApproval");
let mentorDirectory: typeof import("../src/lib/services/mentorDirectory");
let evaluations: typeof import("../src/lib/services/evaluation");
let notifications: typeof import("../src/lib/services/notification");
let rateLimit: typeof import("../src/lib/security/rate-limit");
let cron: typeof import("../src/app/api/cron/communication/route");
let passwordReset: typeof import("../src/lib/auth/password-reset");
let logout: typeof import("../src/app/api/auth/logout/route");
let jwt: typeof import("../src/lib/auth/jwt");
let redirects: typeof import("../src/lib/auth/redirect");
const restorers: Array<() => void> = [];
const modelOverrides = new Map<
  string,
  { descriptor: PropertyDescriptor | undefined; methods: Record<string, (...args: unknown[]) => unknown> }
>();

before(async () => {
  ({ prisma } = await import("../src/lib/prisma"));
  guards = await import("../src/lib/auth/guards");
  sessions = await import("../src/lib/auth/session");
  approvals = await import("../src/lib/services/mentorApproval");
  mentorDirectory = await import("../src/lib/services/mentorDirectory");
  evaluations = await import("../src/lib/services/evaluation");
  notifications = await import("../src/lib/services/notification");
  rateLimit = await import("../src/lib/security/rate-limit");
  cron = await import("../src/app/api/cron/communication/route");
  passwordReset = await import("../src/lib/auth/password-reset");
  logout = await import("../src/app/api/auth/logout/route");
  jwt = await import("../src/lib/auth/jwt");
  redirects = await import("../src/lib/auth/redirect");
});

afterEach(() => {
  for (const restore of restorers.splice(0).reverse()) restore();
  modelOverrides.clear();
});

after(async () => {
  await prisma.$disconnect();
});

const admin = { sub: "admin-1", role: "ADMIN", status: "ACTIVE" } as const;
const moderator = { sub: "moderator-1", role: "MODERATOR", status: "ACTIVE" } as const;
const mentor = { sub: "mentor-1", role: "MENTOR", status: "ACTIVE" } as const;
const student = { sub: "student-1", role: "STUDENT", status: "ACTIVE" } as const;

function stubModel(
  model: string,
  method: string,
  implementation: (...args: unknown[]) => unknown
): void {
  let override = modelOverrides.get(model);
  if (!override) {
    override = {
      descriptor: Object.getOwnPropertyDescriptor(prisma, model),
      methods: {},
    };
    modelOverrides.set(model, override);
    const current = Reflect.get(prisma, model) as object;
    Object.defineProperty(prisma, model, {
      configurable: true,
      writable: true,
      value: new Proxy(override.methods, {
        get(target, property, receiver) {
          if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
          const value = Reflect.get(current, property);
          return typeof value === "function" ? value.bind(current) : value;
        },
      }),
    });
    restorers.push(() => {
      if (override?.descriptor) Object.defineProperty(prisma, model, override.descriptor);
      else Reflect.deleteProperty(prisma, model);
    });
  }
  override.methods[method] = implementation;
}

function forbidden(work: () => Promise<unknown>) {
  return assert.rejects(work, (error: unknown) =>
    error instanceof guards.AuthError && error.status === 403
  );
}

test("admin is limited to departments in their university", async () => {
  stubModel("department", "findUnique", async () => ({ universityId: "u1" }));
  stubModel("user", "findUnique", async () => ({ universityId: "u1" }));
  await guards.requireModeratorOwnsDepartment(admin, "d1");

  stubModel("department", "findUnique", async () => ({ universityId: "u2" }));
  await forbidden(() => guards.requireModeratorOwnsDepartment(admin, "d2"));
});

test("moderator is limited to their own department", async () => {
  stubModel("department", "findUnique", async () => ({ universityId: "u1" }));
  stubModel("user", "findUnique", async () => ({ universityId: "u1" }));
  stubModel("moderatorProfile", "findUnique", async () => ({ departmentId: "d1" }));
  await guards.requireModeratorOwnsDepartment(moderator, "d1");
  await forbidden(() => guards.requireModeratorOwnsDepartment(moderator, "d2"));
});

test("mentor batch access requires approval and an assignment", async () => {
  let profileLookups = 0;
  stubModel("mentorProfile", "findUnique", async () => {
    profileLookups += 1;
    return profileLookups === 1
      ? { approvalStatus: "APPROVED" }
      : { departmentId: "d1" };
  });
  stubModel("mentorBatch", "findUnique", async () => ({
    batch: { departmentId: "d1", department: { universityId: "u1" } },
  }));
  stubModel("user", "findUnique", async () => ({ universityId: "u1" }));
  await guards.requireMentorOwnsBatch(mentor, "b1");

  let lookups = 0;
  stubModel("mentorProfile", "findUnique", async () => {
    lookups += 1;
    return lookups === 1 ? { approvalStatus: "APPROVED" } : { departmentId: "d1" };
  });
  stubModel("mentorBatch", "findUnique", async () => null);
  stubModel("user", "findUnique", async () => ({ universityId: "u1" }));
  await forbidden(() => guards.requireMentorOwnsBatch(mentor, "b2"));
});

test("students can access only their own student data", async () => {
  await guards.requireStudentIsSelf(student, "student-1");
  await forbidden(() => guards.requireStudentIsSelf(student, "student-2"));
});

test("suspended, rejected, and superseded sessions are rejected", () => {
  assert.equal(
    sessions.isCurrentAccountSession({ tokenVersion: 0 }, { status: "ACTIVE", tokenVersion: 0 }),
    true
  );
  assert.equal(
    sessions.isCurrentAccountSession({ tokenVersion: 0 }, { status: "SUSPENDED", tokenVersion: 0 }),
    false
  );
  assert.equal(
    sessions.isCurrentAccountSession({ tokenVersion: 0 }, { status: "REJECTED", tokenVersion: 0 }),
    false
  );
  assert.equal(
    sessions.isCurrentAccountSession({ tokenVersion: 1 }, { status: "ACTIVE", tokenVersion: 2 }),
    false
  );
});

test("password reset increments the session version and old versions stop matching", async () => {
  let updateData:
    | { passwordHash: string; tokenVersion: { increment: number } }
    | undefined;
  await passwordReset.updatePasswordAndInvalidateSessions(
    {
      user: {
        update: async (args) => {
          updateData = args.data;
        },
      },
    },
    "user-1",
    "new-password-hash"
  );
  assert.deepEqual(updateData?.tokenVersion, { increment: 1 });
  assert.equal(
    sessions.isCurrentAccountSession({ tokenVersion: 0 }, { status: "ACTIVE", tokenVersion: 1 }),
    false
  );
});

test("rate limiting blocks only after the configured count and calculates retry time", () => {
  const now = 1_000_000;
  assert.equal(rateLimit.getRateLimitRetryAfter(30, 30, new Date(now - 1_000), 900_000, now), null);
  assert.equal(rateLimit.getRateLimitRetryAfter(31, 30, new Date(now - 1_000), 900_000, now), 899);
  assert.equal(rateLimit.getRateLimitRetryAfter(31, 30, new Date(now - 901_000), 900_000, now), 1);
});

test("rate-limit responses carry Retry-After and trusted client IP is selected", () => {
  const request = new NextRequest("http://localhost/api/test", {
    headers: { "x-real-ip": "192.0.2.10", "x-forwarded-for": "198.51.100.1" },
  });
  assert.equal(rateLimit.getClientIp(request), "192.0.2.10");
  assert.equal(rateLimit.rateLimitResponse(30).headers.get("retry-after"), "30");
});

test("cron authorization requires the exact bearer secret", () => {
  const authorized = new NextRequest("http://localhost/api/cron/communication", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
  });
  const wrong = new NextRequest("http://localhost/api/cron/communication", {
    method: "POST",
    headers: { authorization: "Bearer wrong-secret" },
  });
  assert.equal(cron.isCommunicationCronAuthorized(authorized, "test-secret"), true);
  assert.equal(cron.isCommunicationCronAuthorized(wrong, "test-secret"), false);
  assert.equal(cron.isCommunicationCronAuthorized(authorized, undefined), false);
});

test("admin cannot approve a mentor from another university", async () => {
  stubModel("mentorProfile", "findUnique", async () => ({
    user: { id: "mentor-2", email: "mentor@example.test" },
    departmentId: "d2",
    department: { university: { name: "University 2" } },
    approvalStatus: "PENDING_APPROVAL",
  }));
  stubModel("department", "findUnique", async () => ({ universityId: "u2" }));
  stubModel("user", "findUnique", async () => ({ universityId: "u1" }));
  await forbidden(() => approvals.approveMentor(admin, "mentor-2"));
});

test("admin pending mentor query is university-filtered", async () => {
  let query: { where?: { department?: { universityId?: string } } } | undefined;
  stubModel("user", "findUnique", async () => ({ universityId: "u1" }));
  stubModel("mentorProfile", "findMany", async (args) => {
    query = args as typeof query;
    return [];
  });
  await approvals.listPendingMentors(admin);
  assert.equal(query?.where?.department?.universityId, "u1");
});

test("approved mentor directory is restricted to the caller's university", async () => {
  let query: { where?: { department?: { universityId?: string }; departmentId?: string } } | undefined;
  stubModel("user", "findUnique", async () => ({ universityId: "u1" }));
  stubModel("mentorProfile", "findMany", async (args) => {
    query = args as typeof query;
    return [];
  });

  await mentorDirectory.listApprovedMentors(admin);
  assert.equal(query?.where?.department?.universityId, "u1");
  assert.equal(query?.where?.departmentId, undefined);
});

test("admin cannot request approved mentors from another university", async () => {
  let queryCount = 0;
  stubModel("user", "findUnique", async () => ({ universityId: "u1" }));
  stubModel("department", "findUnique", async () => ({ universityId: "u2" }));
  stubModel("mentorProfile", "findMany", async () => {
    queryCount += 1;
    return [];
  });

  await forbidden(() => mentorDirectory.listApprovedMentors(admin, "d2"));
  assert.equal(queryCount, 0);
});

test("evaluation access checks admin and moderator scope before reading records", async () => {
  let evaluationQueryCount = 0;
  stubModel("mentorProfile", "findUnique", async () => ({
    departmentId: "d2",
    department: { universityId: "u2" },
  }));
  stubModel("department", "findUnique", async () => ({ universityId: "u2" }));
  stubModel("user", "findUnique", async () => ({ universityId: "u1" }));
  stubModel("mentorEvaluation", "findMany", async () => {
    evaluationQueryCount += 1;
    return [];
  });

  await forbidden(() => evaluations.listEvaluationsForMentor(admin, "mentor-2"));
  assert.equal(evaluationQueryCount, 0);

  stubModel("department", "findUnique", async () => ({ universityId: "u1" }));
  stubModel("moderatorProfile", "findUnique", async () => ({ departmentId: "d1" }));
  await forbidden(() => evaluations.listEvaluationsForMentor(moderator, "mentor-2"));
  assert.equal(evaluationQueryCount, 0);
});

test("logout increments token version to revoke the refresh session", async () => {
  const originalSecret = process.env.JWT_REFRESH_SECRET;
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  restorers.push(() => {
    if (originalSecret === undefined) delete process.env.JWT_REFRESH_SECRET;
    else process.env.JWT_REFRESH_SECRET = originalSecret;
  });
  let updateArgs: unknown;
  stubModel("user", "updateMany", async (args) => {
    updateArgs = args;
    return { count: 1 };
  });

  const refreshToken = jwt.signRefreshToken(
    { sub: "student-1", tokenVersion: 4 },
    false
  );
  const request = new NextRequest("http://localhost/api/auth/logout", {
    method: "POST",
    headers: { cookie: `refresh_token=${refreshToken}` },
  });
  const response = await logout.POST(request);

  assert.deepEqual(updateArgs, {
    where: { id: "student-1", tokenVersion: 4 },
    data: { tokenVersion: { increment: 1 } },
  });
  assert.equal(response.cookies.get("refresh_token")?.value, "");
  assert.equal(response.cookies.get("access_token")?.value, "");
});

test("login redirect accepts only safe same-origin paths", () => {
  assert.equal(redirects.getSafeRedirectPath("/student/dashboard?tab=1"), "/student/dashboard?tab=1");
  assert.equal(redirects.getSafeRedirectPath("https://evil.example"), null);
  assert.equal(redirects.getSafeRedirectPath("//evil.example/path"), null);
  assert.equal(redirects.getSafeRedirectPath("/\\\\evil.example/path"), null);
  assert.equal(redirects.getSafeRedirectPath("/login?next=/student/dashboard"), null);
});

test("notifications are filtered by the caller's university and identity", async () => {
  stubModel("user", "findUnique", async () => ({ universityId: "u1" }));
  stubModel("studentProfile", "findUnique", async () => ({
    departmentId: "d1",
    user: { universityId: "u1", status: "ACTIVE" },
  }));
  stubModel("studentBatch", "findMany", async () => []);
  stubModel("notification", "findMany", async () => [
    {
      id: "n1",
      type: "NOTICE",
      title: "Foreign notice",
      message: "Not visible",
      href: null,
      readAt: null,
      createdAt: new Date(),
      sourceKey: "notice:1",
      notice: {
        status: "ACTIVE",
        createdBy: { universityId: "u2" },
        targetType: "ALL",
        targetDepartmentId: null,
        targetDepartment: null,
        targetBatchId: null,
        targetBatch: null,
        targetStudentId: null,
        targetStudent: null,
      },
      session: null,
    },
  ]);
  const result = await notifications.listNotifications(student);
  assert.deepEqual(result.notifications, []);
  assert.equal(result.unreadCount, 0);
});
