import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public read: needed on the registration form before the person has an
// account. Only non-sensitive fields (id/name/code) are exposed.
export async function GET() {
  const departments = await prisma.department.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ departments });
}
