import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/test";

let prisma: typeof import("../src/lib/prisma").prisma;
let guards: typeof import("../src/lib/auth/guards");
let coordination: typeof import("../src/lib/services/coordination");
const restorers: Array<() => void> = [];
const modelOverrides = new Map<
  string,
  { descriptor: PropertyDescriptor | undefined; methods: Record<string, (...args: unknown[]) => unknown> }
>();

before(async () => {
  ({ prisma } = await import("../src/lib/prisma"));
  guards = await import("../src/lib/auth/guards");
  coordination = await import("../src/lib/services/coordination");
});

afterEach(() => {
  for (const restore of restorers.splice(0).reverse()) restore();
  modelOverrides.clear();
});

after(async () => {
  await prisma.$disconnect();
});

function stubModel(
  model: string,
  method: string,
  implementation: (...args: unknown[]) => unknown
) {
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

function stubScope(role: "MENTOR" | "MODERATOR") {
  stubModel("mentorProfile", "findUnique", async () =>
    role === "MENTOR" ? { departmentId: "department-1", approvalStatus: "APPROVED" } : null
  );
  stubModel("moderatorProfile", "findUnique", async () =>
    role === "MODERATOR" ? { departmentId: "department-1" } : null
  );
  stubModel("department", "findUnique", async () => ({ universityId: "university-1" }));
  stubModel("user", "findUnique", async () => ({ universityId: "university-1" }));
  stubModel("user", "findMany", async () => [
    { id: "moderator-1", role: "MODERATOR", status: "ACTIVE" },
  ]);
  stubModel("batch", "findMany", async () => [
    { id: "batch-1", name: "Batch One" },
    { id: "batch-2", name: "Batch Two" },
  ]);
  stubModel("batch", "findUnique", async () => ({
    id: "batch-1",
    departmentId: "department-1",
    department: { universityId: "university-1" },
  }));
  stubModel("mentorBatch", "findMany", async () => [{ mentorId: "mentor-2" }]);
  stubModel("moderatorProfile", "findMany", async () => [{ userId: "moderator-2" }]);
  stubModel("notificationPreference", "findMany", async () => []);
  stubModel("notification", "createMany", async () => ({ count: 1 }));
}

test("batch roster returns every current enrollment without account status filters or caps", async () => {
  stubScope("MODERATOR");
  const roster = Array.from({ length: 137 }, (_, index) => ({
    batchId: "batch-1",
    studentId: `student-${index}`,
    batch: { name: "Batch One" },
    student: {
      user: {
        name: `Student ${index}`,
        universityIdNumber: `ID-${index}`,
      },
    },
  }));
  let query: unknown;
  stubModel("studentBatch", "findMany", async (args) => {
    query = args;
    return roster;
  });

  const students = await coordination.listCoordinationBatchStudents(
    { sub: "moderator-1", role: "MODERATOR", status: "ACTIVE" },
    "batch-1"
  );

  assert.equal(students.length, 137);
  assert.deepEqual(query, {
    where: { batchId: "batch-1", leftAt: null },
    select: {
      batchId: true,
      studentId: true,
      batch: { select: { name: true } },
      student: {
        select: {
          user: { select: { name: true, universityIdNumber: true } },
        },
      },
    },
    orderBy: { student: { user: { name: "asc" } } },
  });

  stubModel("studentBatch", "findMany", async (args) => {
    query = args;
    return [roster[0]];
  });
  const searchResults = await coordination.searchCoordinationStudents(
    { sub: "moderator-1", role: "MODERATOR", status: "ACTIVE" },
    "ID-0"
  );
  assert.equal(searchResults[0].id, "student-0");
  assert.deepEqual(
    (query as { where: Record<string, unknown> }).where,
    {
      batchId: { in: ["batch-1", "batch-2"] },
      leftAt: null,
      student: { user: { universityIdNumber: { contains: "ID-0", mode: "insensitive" } } },
    }
  );
});

test("mentor and moderator can complete announcement, support thread, and status flow", async () => {
  const announcement = {
    id: "announcement-1",
    title: "Guidelines",
    content: "Coordinate the upcoming sessions.",
    targetBatchId: "batch-1",
  };
  const comments: Array<{ id: string; content: string; authorId: string }> = [];
  const supportNote = {
    id: "note-1",
    batchId: "batch-1",
    studentId: "student-1",
    title: "Student needs support",
    message: "Please follow up this week.",
    status: "OPEN" as const,
    createdById: "mentor-1",
    batch: { id: "batch-1", name: "Batch One" },
    createdBy: { id: "mentor-1", name: "Mentor One", role: "MENTOR" },
    comments: [],
    updatedAt: new Date("2026-10-04T11:00:00.000Z"),
  };
  const notificationWrites: unknown[] = [];

  stubScope("MODERATOR");
  stubModel("coordinationNotice", "create", async () => announcement);
  const createdAnnouncement = await coordination.createCoordinationAnnouncement(
    { sub: "moderator-1", role: "MODERATOR", status: "ACTIVE" },
    { title: announcement.title, content: announcement.content, targetBatchId: "batch-1" }
  );
  assert.equal(createdAnnouncement.id, announcement.id);
  const departmentAnnouncement = await coordination.createCoordinationAnnouncement(
    { sub: "moderator-1", role: "MODERATOR", status: "ACTIVE" },
    { title: "Department guidance", content: "This applies to all department batches.", targetBatchId: null }
  );
  assert.equal(departmentAnnouncement.id, announcement.id);

  stubScope("MENTOR");
  stubModel("studentBatch", "findFirst", async () => ({ studentId: "student-1" }));
  stubModel("coordinationSupportNote", "create", async () => supportNote);
  stubModel("notification", "createMany", async (args) => {
    notificationWrites.push(args);
    return { count: 1 };
  });
  const createdNote = await coordination.createCoordinationSupportNote(
    { sub: "mentor-1", role: "MENTOR", status: "ACTIVE" },
    {
      batchId: "batch-1",
      studentId: "student-1",
      title: supportNote.title,
      message: supportNote.message,
    }
  );
  assert.equal(createdNote.studentId, "student-1");
  assert.equal(notificationWrites.length, 1);

  stubScope("MODERATOR");
  stubModel("coordinationSupportNote", "findFirst", async () => ({
    id: supportNote.id,
    batchId: supportNote.batchId,
  }));
  stubModel("coordinationComment", "findMany", async () => comments);
  stubModel("coordinationSupportNote", "findFirst", async () => ({
    ...supportNote,
    batch: {
      id: "batch-1",
      name: "Batch One",
      departmentId: "department-1",
      department: { universityId: "university-1" },
    },
    createdBy: { id: supportNote.createdById, name: "Mentor One" },
    comments: [],
  }));
  const visibleComments = await coordination.listCoordinationComments(
    { sub: "moderator-1", role: "MODERATOR", status: "ACTIVE" },
    supportNote.id
  );
  assert.deepEqual(visibleComments, []);

  stubScope("MODERATOR");
  stubModel("coordinationComment", "create", async (args) => {
    const data = (args as { data: { content: string; authorId: string } }).data;
    const comment = { id: "comment-1", ...data };
    comments.push(comment);
    return { ...comment, author: { name: "Moderator One" } };
  });
  stubModel("coordinationSupportNote", "findFirst", async () => ({
    ...supportNote,
    batch: {
      id: "batch-1",
      name: "Batch One",
      departmentId: "department-1",
      department: { universityId: "university-1" },
    },
    createdBy: { id: supportNote.createdById, name: "Mentor One" },
    comments: [],
  }));
  stubModel("notification", "createMany", async (args) => {
    notificationWrites.push(args);
    return { count: 1 };
  });
  const reply = await coordination.createCoordinationComment(
    { sub: "moderator-1", role: "MODERATOR", status: "ACTIVE" },
    supportNote.id,
    "I will follow up with the student."
  );
  assert.equal(reply.content, comments[0].content);
  assert.equal(notificationWrites.length, 2);

  stubScope("MODERATOR");
  stubModel("coordinationComment", "findMany", async () => comments);
  stubModel("coordinationSupportNote", "findFirst", async () => ({
    ...supportNote,
    batch: {
      id: "batch-1",
      name: "Batch One",
      departmentId: "department-1",
      department: { universityId: "university-1" },
    },
    createdBy: { id: supportNote.createdById, name: "Mentor One" },
    comments,
  }));
  const replies = await coordination.listCoordinationComments(
    { sub: "moderator-1", role: "MODERATOR", status: "ACTIVE" },
    supportNote.id
  );
  assert.equal(replies.length, 1);

  stubScope("MODERATOR");
  stubModel("coordinationSupportNote", "update", async (args) => ({
    id: supportNote.id,
    status: (args as { data: { status: "OPEN" | "RESOLVED" } }).data.status,
    updatedAt: new Date("2026-10-04T12:00:00.000Z"),
  }));
  stubModel("coordinationSupportNote", "findFirst", async () => ({
    ...supportNote,
    batch: {
      id: "batch-1",
      name: "Batch One",
      departmentId: "department-1",
      department: { universityId: "university-1" },
    },
    createdBy: { id: supportNote.createdById, name: "Mentor One" },
    comments,
  }));
  stubModel("notification", "createMany", async (args) => {
    notificationWrites.push(args);
    return { count: 1 };
  });
  const updated = await coordination.updateCoordinationSupportStatus(
    { sub: "moderator-1", role: "MODERATOR", status: "ACTIVE" },
    supportNote.id,
    "RESOLVED"
  );
  assert.equal(updated.status, "RESOLVED");
  assert.equal(notificationWrites.length, 3);

  await assert.rejects(
    () => coordination.createCoordinationAnnouncement(
      { sub: "mentor-1", role: "MENTOR", status: "ACTIVE" },
      { title: "Not allowed", content: "Mentors cannot publish guidelines.", targetBatchId: null }
    ),
    (error: unknown) => error instanceof guards.AuthError && error.status === 403
  );
});

test("support note deletion is scoped to the note creator or moderator department", async () => {
  stubScope("MODERATOR");
  stubModel("coordinationSupportNote", "findUnique", async () => ({
    id: "note-1",
    batchId: "batch-1",
    createdById: "mentor-1",
    batch: { department: { universityId: "university-1" } },
  }));
  let deletedId: string | undefined;
  stubModel("coordinationSupportNote", "delete", async (args) => {
    deletedId = (args as { where: { id: string } }).where.id;
    return { id: deletedId };
  });

  const deleted = await coordination.deleteCoordinationSupportNote(
    { sub: "moderator-1", role: "MODERATOR", status: "ACTIVE" },
    "note-1"
  );
  assert.equal(deleted.id, "note-1");
  assert.equal(deletedId, "note-1");

  stubScope("MENTOR");
  await assert.rejects(
    () =>
      coordination.deleteCoordinationSupportNote(
        { sub: "mentor-2", role: "MENTOR", status: "ACTIVE" },
        "note-1"
      ),
    (error: unknown) => error instanceof guards.AuthError && error.status === 403
  );
});
