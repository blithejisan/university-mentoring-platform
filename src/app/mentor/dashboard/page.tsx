import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { MentorEvaluationsDashboard } from "@/components/mentor-evaluations-dashboard";
import { MentorNoticesManagement } from "@/components/mentor-notices-management";
import { MentorRemarksManagement } from "@/components/mentor-remarks-management";
import { BatchPerformanceReport } from "@/components/batch-performance-report";
import { DashboardOverview } from "@/components/dashboard-overview";
import { MentorDashboardPanels } from "@/components/mentor-dashboard-panels";
import { listNotices } from "@/lib/services/notice";
import { CalendarDays, Layers3, UsersRound } from "lucide-react";

export default async function MentorDashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "MENTOR") redirect("/");

  const profile = await prisma.mentorProfile.findUnique({
    where: { userId: session.sub },
    select: {
      approvalStatus: true,
      user: { select: { name: true } },
      department: {
        select: {
          name: true,
          university: { select: { name: true } },
        },
      },
    },
  });
  if (profile?.approvalStatus !== "APPROVED") redirect("/pending-approval");

  const now = new Date();
  const [assignedBatches, activeStudentsCount, upcomingSessionsCount, notices, recentSessions] =
    await Promise.all([
      prisma.mentorBatch.findMany({
        where: { mentorId: session.sub },
        select: {
          batch: {
            select: {
              id: true,
              name: true,
              status: true,
              attendanceSessions: {
                where: {
                  status: "SCHEDULED",
                  OR: [
                    { startTime: { gte: now } },
                    { startTime: null, date: { gte: now } },
                  ],
                },
                orderBy: [{ date: "asc" }, { startTime: "asc" }],
                take: 1,
                select: { date: true, startTime: true, topic: true },
              },
            },
          },
        },
      }),
      prisma.studentProfile.count({
        where: {
          user: { status: "ACTIVE" },
          studentBatches: {
            some: {
              leftAt: null,
              batch: { mentorBatches: { some: { mentorId: session.sub } } },
            },
          },
        },
      }),
      prisma.attendanceSession.count({
        where: {
          status: "SCHEDULED",
          OR: [
            { startTime: { gte: now } },
            { startTime: null, date: { gte: now } },
          ],
          batch: { mentorBatches: { some: { mentorId: session.sub } } },
        },
      }),
      listNotices(session, { status: "ACTIVE" }),
      prisma.attendanceSession.findMany({
        where: {
          status: { in: ["SCHEDULED", "COMPLETED"] },
          batch: { mentorBatches: { some: { mentorId: session.sub } } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          batch: { select: { name: true } },
          topic: true,
          status: true,
          createdAt: true,
          date: true,
        },
      }),
    ]);
  const batchIds = assignedBatches.map(({ batch }) => batch.id);
  const [sessionCountsByStatus, pastScheduledSessions] = batchIds.length
    ? await Promise.all([
        prisma.attendanceSession.groupBy({
          by: ["batchId", "status"],
          where: {
            batchId: { in: batchIds },
            status: { in: ["COMPLETED", "SCHEDULED"] },
          },
          _count: { _all: true },
        }),
        prisma.attendanceSession.groupBy({
          by: ["batchId"],
          where: {
            batchId: { in: batchIds },
            status: "SCHEDULED",
            OR: [
              { startTime: { lte: now } },
              { startTime: null, date: { lte: now } },
            ],
          },
          _count: { _all: true },
        }),
      ])
    : [[], []];
  const sessionsByBatch = new Map<string, { completed: number; scheduled: number }>();
  for (const { batchId, status, _count } of sessionCountsByStatus) {
    const counts = sessionsByBatch.get(batchId) ?? { completed: 0, scheduled: 0 };
    if (status === "COMPLETED") counts.completed += _count._all;
    if (status === "SCHEDULED") counts.scheduled += _count._all;
    sessionsByBatch.set(batchId, counts);
  }
  for (const { batchId, _count } of pastScheduledSessions) {
    const counts = sessionsByBatch.get(batchId);
    if (counts) {
      counts.completed += _count._all;
      counts.scheduled -= _count._all;
    }
  }
  const batchSummaries = assignedBatches
    .map(({ batch }) => {
      const sessionCounts = sessionsByBatch.get(batch.id) ?? { completed: 0, scheduled: 0 };
      return {
        id: batch.id,
        name: batch.name,
        status: batch.status,
        completedSessions: sessionCounts.completed,
        scheduledSessions: sessionCounts.scheduled,
        nextSession: batch.attendanceSessions[0] ?? null,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const activityItems = [
    ...notices.slice(0, 5).map((notice) => ({
      id: `notice-${notice.id}`,
      title: notice.title,
      subtitle: `${
        notice.targetBatch?.name ??
        (notice.targetType === "ALL"
          ? "University notice"
          : notice.targetType === "DEPARTMENT"
            ? "Department notice"
            : notice.targetType === "STUDENT"
              ? "Student notice"
              : "Assigned batch")
      } · Notice posted`,
      occurredAt: notice.createdAt,
      tone: "teal" as const,
    })),
    ...recentSessions.map((sessionItem) => ({
      id: `session-${sessionItem.id}`,
      title: sessionItem.status === "COMPLETED" ? "Session completed" : "Session scheduled",
      subtitle: `${sessionItem.batch.name} · ${sessionItem.topic || "Mentoring session"}`,
      occurredAt: sessionItem.status === "COMPLETED" ? sessionItem.date : sessionItem.createdAt,
      tone: sessionItem.status === "COMPLETED" ? "violet" as const : "blue" as const,
    })),
  ]
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
    .slice(0, 5);

  return (
    <div className="page-enter mx-auto flex w-full max-w-7xl flex-col gap-7">
      <DashboardOverview
        role="Mentor"
        name={profile.user.name}
        universityName={profile.department.university.name}
        departmentName={profile.department.name}
        description="Manage mentoring sessions, stay connected with your students, and follow their progress."
        metrics={[
          { label: "Assigned batches", value: assignedBatches.length, Icon: Layers3, tone: "violet", href: "/mentor/batches" },
          { label: "Active students", value: activeStudentsCount, Icon: UsersRound, tone: "cyan", href: "/mentor/batches" },
          { label: "Upcoming sessions", value: upcomingSessionsCount, Icon: CalendarDays, tone: "teal", href: "/mentor/sessions" },
        ]}
      />

      <MentorDashboardPanels batches={batchSummaries} activities={activityItems} currentTime={now} />

      <div id="notices" className="scroll-mt-4 border-t border-slate-200 pt-6">
        <MentorNoticesManagement />
      </div>

      <div id="remarks" className="scroll-mt-4 border-t border-slate-200 pt-6">
        <MentorRemarksManagement />
      </div>

      <section id="batch-performance" className="scroll-mt-4">
        <BatchPerformanceReport role="MENTOR" />
      </section>

      <div id="my-evaluation" className="scroll-mt-4 border-t border-slate-200 pt-6">
        <MentorEvaluationsDashboard />
      </div>
    </div>
  );
}
