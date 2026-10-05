import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      role: true,
      status: true,
      universityIdNumber: true,
      email: true,
      mentorProfile: { select: { approvalStatus: true, departmentId: true } },
      studentProfile: {
        select: {
          departmentId: true,
          enrolledBatchId: true,
          enrolledBatch: { select: { id: true, name: true } },
        },
      },
      moderatorProfile: { select: { departmentId: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ user });
}
