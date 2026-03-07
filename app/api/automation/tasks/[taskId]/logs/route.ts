import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { unauthorized, notFound } from "@/lib/api-response";
import { RESULT_LOG_STEPS } from "@/lib/automation/constants";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

/**
 * GET /api/automation/tasks/[taskId]/logs
 * Retrieve execution logs for a task.
 * Query params:
 *   - view: "result" (default) shows only result steps, "all" shows all steps
 *   - itemId: filter by specific item
 *   - level: filter by log level (INFO, WARN, ERROR)
 *   - limit: max number of logs (default 100, max 500)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return unauthorized();
  }

  const { taskId } = await context.params;
  const { searchParams } = new URL(request.url);
  
  const view = searchParams.get("view") || "result";
  const itemId = searchParams.get("itemId");
  const level = searchParams.get("level");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "100", 10), 1), 500);

  const task = await prisma.automationTask.findUnique({
    where: { id: taskId },
    select: { id: true },
  });

  if (!task) {
    return notFound("任务不存在");
  }

  const where: {
    taskId: string;
    itemId?: string;
    level?: string;
    step?: { in: string[] };
  } = { taskId };

  if (view === "result") {
    where.step = { in: [...RESULT_LOG_STEPS] };
  }

  if (itemId) {
    where.itemId = itemId;
  }

  if (level && ["INFO", "WARN", "ERROR"].includes(level)) {
    where.level = level;
  }

  const logs = await prisma.automationTaskLog.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      taskId: true,
      itemId: true,
      level: true,
      step: true,
      message: true,
      data: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    logs,
    total: logs.length,
    view,
  });
}

export const runtime = "nodejs";
