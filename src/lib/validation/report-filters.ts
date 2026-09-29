import { AuthError } from "@/lib/auth/guards";

export interface ReportFilters {
  from?: Date;
  to?: Date;
  batchId?: string;
  mentorId?: string;
  departmentId?: string;
}

function parseDate(value: string | null, label: string): Date | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AuthError(`Invalid ${label} date. Use YYYY-MM-DD.`, 400);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new AuthError(`Invalid ${label} date.`, 400);
  }
  return parsed;
}

export function parseReportFilters(searchParams: URLSearchParams): ReportFilters {
  const from = parseDate(searchParams.get("from"), "start");
  const toDate = parseDate(searchParams.get("to"), "end");
  const to = toDate ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined;

  if (from && to && from > to) {
    throw new AuthError("Start date must be on or before end date.", 400);
  }

  const optionalId = (name: string) => searchParams.get(name)?.trim() || undefined;
  return {
    from,
    to,
    batchId: optionalId("batchId"),
    mentorId: optionalId("mentorId"),
    departmentId: optionalId("departmentId"),
  };
}

export function reportDateWhere(filters: ReportFilters): { gte?: Date; lte?: Date } | undefined {
  if (!filters.from && !filters.to) return undefined;
  return {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {}),
  };
}
