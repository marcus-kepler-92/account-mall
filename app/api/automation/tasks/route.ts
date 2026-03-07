import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import {
  unauthorized,
  badRequest,
  invalidJsonBody,
  validationError,
  notFound,
} from "@/lib/api-response";
import {
  AUTOMATION_CATEGORY,
  AUTOMATION_TASK_STATUS,
  AUTOMATION_TASK_ITEM_STATUS,
} from "@/lib/automation/constants";
import { automationTaskListQuerySchema } from "@/lib/automation/validations";

const MAX_BATCH_CARDS = 100;

function parseCreateTaskBody(
  body: unknown
): { ok: true; data: { productId: string; presetId: string; cardIds: string[]; inputConfig?: Record<string, unknown> } } | { ok: false; errors: Record<string, string[]> } {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: { _: ["Invalid JSON body"] } };
  }
  const o = body as Record<string, unknown>;
  const errors: Record<string, string[]> = {};

  const productId = o.productId;
  if (typeof productId !== "string" || !productId.trim()) {
    errors.productId = ["Required"];
  }
  const presetId = o.presetId;
  if (typeof presetId !== "string" || !presetId.trim()) {
    errors.presetId = ["Required"];
  }
  const cardIdsRaw = o.cardIds;
  if (!Array.isArray(cardIdsRaw)) {
    errors.cardIds = ["At least one card is required"];
  } else {
    const cardIds = cardIdsRaw.filter((id): id is string => typeof id === "string" && id.length > 0);
    if (cardIds.length === 0) {
      errors.cardIds = ["At least one card is required"];
    } else if (cardIds.length > MAX_BATCH_CARDS) {
      errors.cardIds = [`Maximum ${MAX_BATCH_CARDS} cards per task`];
    }
  }
  const inputConfig = o.inputConfig;
  if (inputConfig !== undefined && (inputConfig === null || typeof inputConfig !== "object" || Array.isArray(inputConfig))) {
    errors.inputConfig = ["Must be an object"];
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const cardIds = Array.isArray(o.cardIds)
    ? (o.cardIds as string[]).filter((id) => typeof id === "string" && id.length > 0)
    : [];
  return {
    ok: true,
    data: {
      productId: (o.productId as string).trim(),
      presetId: (o.presetId as string).trim(),
      cardIds,
      inputConfig: o.inputConfig as Record<string, unknown> | undefined,
    },
  };
}

/**
 * GET /api/automation/tasks
 * List automation tasks (Apple category only).
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);

  const rawQuery = {
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    productId: searchParams.get("productId") ?? undefined,
    presetKey: searchParams.get("presetKey") ?? undefined,
  };

  const parsed = automationTaskListQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return validationError(parsed.error.flatten());
  }

  const { page, pageSize, status, productId, presetKey } = parsed.data;

  const where: Record<string, unknown> = {
    category: AUTOMATION_CATEGORY.APPLE,
  };

  if (status && status !== "ALL") {
    where.status = status;
  }
  if (productId) {
    where.productId = productId;
  }
  if (presetKey && presetKey !== "ALL") {
    where.preset = { presetKey };
  }

  const [tasks, total] = await Promise.all([
    prisma.automationTask.findMany({
      where,
      include: {
        product: { select: { id: true, name: true } },
        preset: { select: { id: true, name: true, presetKey: true, presetType: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.automationTask.count({ where }),
  ]);

  const taskIds = tasks.map((t) => t.id);
  const itemStats = await prisma.automationTaskItem.groupBy({
    by: ["taskId", "status"],
    where: { taskId: { in: taskIds } },
    _count: { id: true },
  });

  const statsMap = new Map<string, Record<string, number>>();
  for (const stat of itemStats) {
    if (!statsMap.has(stat.taskId)) {
      statsMap.set(stat.taskId, {});
    }
    statsMap.get(stat.taskId)![stat.status] = stat._count.id;
  }

  const data = tasks.map((task) => {
    const stats = statsMap.get(task.id) || {};
    return {
      id: task.id,
      category: task.category,
      product: task.product,
      preset: task.preset,
      status: task.status,
      createdBy: task.createdBy,
      summary: task.summary,
      createdAt: task.createdAt,
      itemCount: task._count.items,
      itemStats: {
        pending: stats[AUTOMATION_TASK_ITEM_STATUS.PENDING] ?? 0,
        running: stats[AUTOMATION_TASK_ITEM_STATUS.RUNNING] ?? 0,
        success: stats[AUTOMATION_TASK_ITEM_STATUS.SUCCESS] ?? 0,
        failed: stats[AUTOMATION_TASK_ITEM_STATUS.FAILED] ?? 0,
      },
    };
  });

  return NextResponse.json({ data, total, page, pageSize });
}

/**
 * POST /api/automation/tasks
 * Create a new automation task (Apple category only).
 */
export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJsonBody();
  }

  const parsed = parseCreateTaskBody(body);
  if (!parsed.ok) {
    return validationError({ fieldErrors: parsed.errors });
  }

  const { productId, presetId, cardIds, inputConfig } = parsed.data;

  const preset = await prisma.productAutomationPreset.findUnique({
    where: { id: presetId },
    select: {
      id: true,
      productId: true,
      category: true,
      isEnabled: true,
      presetKey: true,
    },
  });

  if (!preset) {
    return notFound("Preset not found");
  }

  if (preset.category !== AUTOMATION_CATEGORY.APPLE) {
    return badRequest("Only Apple category is supported");
  }

  if (!preset.isEnabled) {
    return badRequest("Preset is disabled");
  }

  if (preset.productId !== productId) {
    return badRequest("Preset does not belong to this product");
  }

  const cards = await prisma.card.findMany({
    where: {
      id: { in: cardIds },
      productId,
    },
    select: { id: true },
  });

  const foundCardIds = new Set(cards.map((c) => c.id));
  const validCardIds = cardIds.filter((id) => foundCardIds.has(id));

  if (validCardIds.length === 0) {
    return badRequest("No valid cards found for this product");
  }

  const task = await prisma.automationTask.create({
    data: {
      category: AUTOMATION_CATEGORY.APPLE,
      productId,
      presetId,
      status: AUTOMATION_TASK_STATUS.PENDING,
      createdBy: session.user.email ?? session.user.id,
      inputConfig: (inputConfig ?? {}) as Prisma.InputJsonValue,
      items: {
        create: validCardIds.map((cardId) => ({
          cardId,
          status: AUTOMATION_TASK_ITEM_STATUS.PENDING,
        })),
      },
    },
    include: {
      preset: { select: { name: true, presetKey: true } },
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json(
    {
      id: task.id,
      status: task.status,
      preset: task.preset,
      itemCount: task._count.items,
      skipped: cardIds.length - validCardIds.length,
    },
    { status: 201 }
  );
}

export const runtime = "nodejs";
