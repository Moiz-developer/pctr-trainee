import { prisma } from "../../lib/prisma.js";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * §14.3: "hours consumed" = the sum of `duration_minutes` across the
 * caller's own `training_sessions` rows with status = COMPLETED ("only
 * COMPLETED counts toward hours consumed"), converted to hours.
 */
export async function getConsumedHours(userId: string): Promise<number> {
  const result = await prisma.trainingSession.aggregate({
    where: { userId, status: "COMPLETED" },
    _sum: { durationMinutes: true },
  });
  return round2((result._sum.durationMinutes ?? 0) / 60);
}

/**
 * §14.3: "A user's required hours = the most recent applicable USER-scope
 * row if present, else the most recent applicable row for any of their
 * departments (highest wins ... documented in training-hours.service.ts)."
 * This is the documented resolution: an individual override always wins
 * outright; absent one, the highest `required_hours` among each department's
 * own most-recent applicable row applies (never summed across departments —
 * summing would let merely belonging to more departments inflate a trainee's
 * requirement, which isn't a meaningful reading of "required hours").
 * "Applicable" = `effective_from <= today`.
 */
export async function getAllocatedHours(userId: string, departmentIds: string[]): Promise<number> {
  const today = new Date();

  const userRow = await prisma.trainingHourRequirement.findFirst({
    where: { scope: "USER", userId, effectiveFrom: { lte: today } },
    orderBy: { effectiveFrom: "desc" },
  });
  if (userRow) return round2(Number(userRow.requiredHours));

  if (departmentIds.length === 0) return 0;

  const departmentRows = await prisma.trainingHourRequirement.findMany({
    where: {
      scope: "DEPARTMENT",
      departmentId: { in: departmentIds },
      effectiveFrom: { lte: today },
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (departmentRows.length === 0) return 0;

  const latestByDepartment = new Map<string, (typeof departmentRows)[number]>();
  for (const row of departmentRows) {
    // Rows are already ordered effectiveFrom desc, so the first row seen per
    // department is that department's most recent applicable row.
    if (!latestByDepartment.has(row.departmentId as string)) {
      latestByDepartment.set(row.departmentId as string, row);
    }
  }

  let highest = 0;
  for (const row of latestByDepartment.values()) {
    highest = Math.max(highest, Number(row.requiredHours));
  }
  return round2(highest);
}
