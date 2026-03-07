import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import {
  unauthorized,
  badRequest,
  notFound,
  invalidJsonBody,
  validationError,
} from "@/lib/api-response";
import {
  AUTOMATION_CATEGORY,
  AUTOMATION_TASK_STATUS,
  AUTOMATION_TASK_ITEM_STATUS,
} from "@/lib/automation/constants";
import { retryAutomationTaskSchema } from "@/lib/automation/validations";

const MAX_BATCH_CARDS = 100;

function parseUpdateTaskBody(body: unknown): {
  ok: true;
  data: {
    inputConfig?: Record<string, unknown>;
    summary?: unknown;
    cardIds?: string[];
  };
} | { ok: false; errors: Record<string, string[]> } {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: { _: ["Invalid JSON body"] } };
  }
  const o = body as Record<string, unknown>;
  const errors: Record<string, string[]> = {};
  const data: { inputConfig?: Record<string, unknown>; summary?: unknown; cardIds?: string[] } = {};

  if (o.inputConfig !== undefined) {
    if (o.inputConfig === null || typeof o.inputConfig !== "object" || Array.isArray(o.inputConfig)) {
      errors.inputConfig = ["Must be an object"];
    } else {
      data.inputConfig = o.inputConfig as Record<string, unknown>;
    }
  }
  if (o.summary !== undefined) {
    data.summary = o.summary;
  }
  if (o.cardIds !== undefined) {
    if (!Array.isArray(o.cardIds)) {
      errors.cardIds = ["Must be an array"];
    } else {
      const arr = o.cardIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
      if (arr.length > MAX_BATCH_CARDS) {
        errors.cardIds = [`Maximum ${MAX_BATCH_CARDS} cards`];
      } else {
        data.cardIds = arr;
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (data.inputConfig === undefined && data.summary === undefined && data.cardIds === undefined) {
    return { ok: false, errors: { _: ["No fields to update"] } };
  }
  return { ok: true, data };
}

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

/**
 * GET /api/automation/tasks/[taskId]
 * Get task details with items.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return unauthorized();
  }

  const { taskId } = await context.params;

  const task = await prisma.automationTask.findUnique({
    where: { id: taskId },
    include: {
      product: { select: { id: true, name: true } },
      preset: {
        select: { id: true, name: true, presetKey: true, presetType: true },
      },
      items: {
        include: {
          card: { select: { id: true, content: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!task) {
    return notFound("Task not found");
  }

  if (task.category !== AUTOMATION_CATEGORY.APPLE) {
    return badRequest("Only Apple category is supported");
  }

  const itemStats = {
    pending: 0,
    running: 0,
    success: 0,
    failed: 0,
  };

  for (const item of task.items) {
    switch (item.status) {
      case AUTOMATION_TASK_ITEM_STATUS.PENDING:
        itemStats.pending++;
        break;
      case AUTOMATION_TASK_ITEM_STATUS.RUNNING:
        itemStats.running++;
        break;
      case AUTOMATION_TASK_ITEM_STATUS.SUCCESS:
        itemStats.success++;
        break;
      case AUTOMATION_TASK_ITEM_STATUS.FAILED:
        itemStats.failed++;
        break;
    }
  }

  const maskContent = (content: string) => {
    if (content.length <= 8) return content;
    return content.slice(0, 8) + "***";
  };

  return NextResponse.json({
    id: task.id,
    category: task.category,
    product: task.product,
    preset: task.preset,
    status: task.status,
    createdBy: task.createdBy,
    inputConfig: task.inputConfig,
    summary: task.summary,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    itemStats,
    items: task.items.map((item) => ({
      id: item.id,
      cardId: item.cardId,
      cardContentMasked: maskContent(item.card.content),
      status: item.status,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      retryCount: item.retryCount,
      resultJson: item.resultJson,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  });
}

/**
 * POST /api/automation/tasks/[taskId]
 * Retry failed items in a task.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return unauthorized();
  }

  const { taskId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJsonBody();
  }

  const parsed = retryAutomationTaskSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.flatten());
  }

  const { itemIds } = parsed.data;

  const task = await prisma.automationTask.findUnique({
    where: { id: taskId },
    select: { id: true, category: true, status: true },
  });

  if (!task) {
    return notFound("Task not found");
  }

  if (task.category !== AUTOMATION_CATEGORY.APPLE) {
    return badRequest("Only Apple category is supported");
  }

  const where: Record<string, unknown> = {
    taskId,
    status: AUTOMATION_TASK_ITEM_STATUS.FAILED,
  };

  if (itemIds && itemIds.length > 0) {
    where.id = { in: itemIds };
  }

  const result = await prisma.automationTaskItem.updateMany({
    where,
    data: {
      status: AUTOMATION_TASK_ITEM_STATUS.PENDING,
      errorCode: null,
      errorMessage: null,
    },
  });

  if (result.count > 0) {
    await prisma.automationTask.update({
      where: { id: taskId },
      data: { status: AUTOMATION_TASK_STATUS.PENDING },
    });
  }

  return NextResponse.json({
    retriedCount: result.count,
  });
}

/**
 * PATCH /api/automation/tasks/[taskId]
 * Update task (inputConfig, summary, cardIds).
 * cardIds: replace selection; only PENDING items can be removed; only UNSOLD cards of same product can be added.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return unauthorized();
  }

  const { taskId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJsonBody();
  }

  const parsed = parseUpdateTaskBody(body);
  if (!parsed.ok) {
    return validationError({ fieldErrors: parsed.errors });
  }

  const task = await prisma.automationTask.findUnique({
    where: { id: taskId },
    select: { id: true, category: true, productId: true },
  });

  if (!task) {
    return notFound("Task not found");
  }

  if (task.category !== AUTOMATION_CATEGORY.APPLE) {
    return badRequest("Only Apple category is supported");
  }

  if (parsed.data.cardIds !== undefined) {
    const newCardIds = [...new Set(parsed.data.cardIds)];
    const currentItems = await prisma.automationTaskItem.findMany({
      where: { taskId },
      select: { id: true, cardId: true, status: true },
    });
    const currentCardIds = new Set(currentItems.map((i) => i.cardId));

    const toAdd = newCardIds.filter((id) => !currentCardIds.has(id));
    if (toAdd.length > 0) {
      const validCards = await prisma.card.findMany({
        where: { id: { in: toAdd }, productId: task.productId, status: "UNSOLD" },
        select: { id: true },
      });
      const validIds = new Set(validCards.map((c) => c.id));
      const invalid = toAdd.filter((id) => !validIds.has(id));
      if (invalid.length > 0) {
        return badRequest("部分卡密不属于本商品或已售出，无法加入");
      }
      await prisma.automationTaskItem.createMany({
        data: toAdd.map((cardId) => ({
          taskId,
          cardId,
          status: AUTOMATION_TASK_ITEM_STATUS.PENDING,
        })),
        skipDuplicates: true,
      });
    }

    const toRemove = currentItems.filter(
      (i) => i.status === AUTOMATION_TASK_ITEM_STATUS.PENDING && !newCardIds.includes(i.cardId)
    );
    if (toRemove.length > 0) {
      await prisma.automationTaskItem.deleteMany({
        where: { id: { in: toRemove.map((i) => i.id) } },
      });
    }

    if (toAdd.length > 0 || toRemove.length > 0) {
      await prisma.automationTask.update({
        where: { id: taskId },
        data: { status: AUTOMATION_TASK_STATUS.PENDING },
      });
    }
  }

  const data: Prisma.AutomationTaskUpdateInput = {};
  if (parsed.data.inputConfig !== undefined) {
    const raw = parsed.data.inputConfig as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      normalized[k] = typeof v === "string" ? v.trim() : v;
    }
    data.inputConfig = normalized as Prisma.InputJsonValue;
  }
  if (parsed.data.summary !== undefined) {
    data.summary = parsed.data.summary as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length > 0) {
    await prisma.automationTask.update({
      where: { id: taskId },
      data,
    });
  }

  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
