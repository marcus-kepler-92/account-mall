import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { chromium, type Page } from "playwright";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { unauthorized, badRequest, notFound } from "@/lib/api-response";
import {
  AUTOMATION_CATEGORY,
  AUTOMATION_TASK_STATUS,
  AUTOMATION_TASK_ITEM_STATUS,
  AUTOMATION_PRESET_TYPES,
  LOG_STEPS,
  PLAYWRIGHT_CONTEXT_GROUP_SIZE,
  PLAYWRIGHT_DEFAULT_HEADLESS,
  isAutomationDebug,
  PLAYWRIGHT_DEBUG_SLOW_MO_MS,
} from "@/lib/automation/constants";
import { getRunner } from "@/lib/automation/runners";
import { createTaskLogger } from "@/lib/automation/logger";
import { serverLog } from "@/lib/automation/server-log";
import {
  parseFreeSharedCardContent,
  toCardContentJson,
  type FreeSharedCardPayload,
} from "@/lib/free-shared-card";

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

/**
 * POST /api/automation/tasks/[taskId]/run
 * Execute only PENDING items in a task.
 * FAILED items must be retried first (reset to PENDING) before execution.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return unauthorized();
  }

  const { taskId } = await context.params;

  let body: { itemIds?: string[] } = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // Empty body is fine
  }

  const task = await prisma.automationTask.findUnique({
    where: { id: taskId },
    include: {
      preset: {
        select: {
          id: true,
          adapterKey: true,
          presetType: true,
          configJson: true,
        },
      },
    },
  });

  if (!task) {
    return notFound("Task not found");
  }

  if (task.category !== AUTOMATION_CATEGORY.APPLE) {
    return badRequest("Only Apple category is supported");
  }

  if (task.status === AUTOMATION_TASK_STATUS.RUNNING) {
    return badRequest("任务正在执行中，请勿重复提交");
  }

  // Build item query - only PENDING items can be executed
  // FAILED items must be retried first (reset to PENDING) before execution
  const itemWhere = {
    taskId,
    status: AUTOMATION_TASK_ITEM_STATUS.PENDING,
    ...(body.itemIds && body.itemIds.length > 0 ? { id: { in: body.itemIds } } : {}),
  };

  const items = await prisma.automationTaskItem.findMany({
    where: itemWhere,
    include: {
      card: { select: { id: true, content: true, productId: true } },
    },
  });

  // Count skipped non-PENDING items if specific itemIds were requested
  let skippedCount = 0;
  if (body.itemIds && body.itemIds.length > 0) {
    skippedCount = body.itemIds.length - items.length;
  }

  if (items.length === 0) {
    return NextResponse.json({
      message: "没有待执行的项目（失败项请先重试再执行）",
      processed: 0,
      skipped: skippedCount,
    });
  }

  const runner = getRunner(task.preset.adapterKey);
  if (!runner) {
    return badRequest(`Unsupported adapter: ${task.preset.adapterKey}`);
  }

  await prisma.automationTask.update({
    where: { id: taskId },
    data: { status: AUTOMATION_TASK_STATUS.RUNNING },
  });

  const taskLogger = createTaskLogger(taskId);
  const runStartAt = Date.now();

  serverLog("info", "run started", {
    taskId,
    itemCount: items.length,
    presetType: task.preset.presetType,
  });

  await taskLogger.log(LOG_STEPS.TASK_START, `开始执行任务，共 ${items.length} 项`, {
    totalItems: items.length,
    presetType: task.preset.presetType,
  });

  const presetConfig = (task.preset.configJson as Record<string, unknown>) || {};
  const inputConfig = (task.inputConfig as Record<string, unknown>) || {};
  const isPasswordChange = task.preset.presetType === AUTOMATION_PRESET_TYPES.CHANGE_PASSWORD;
  const isChangeRegion = task.preset.presetType === AUTOMATION_PRESET_TYPES.CHANGE_REGION;

  const headless =
    process.env.AUTOMATION_HEADLESS !== undefined
      ? process.env.AUTOMATION_HEADLESS === "true"
      : PLAYWRIGHT_DEFAULT_HEADLESS;

  const launchOptions: { headless: boolean; slowMo?: number } = { headless };
  if (isAutomationDebug()) {
    launchOptions.slowMo = PLAYWRIGHT_DEBUG_SLOW_MO_MS;
  }

  let successCount = 0;
  let failedCount = 0;

  const browser = await chromium.launch(launchOptions);
  serverLog("info", "browser launched", { taskId });

  const itemChunks = chunk(items, PLAYWRIGHT_CONTEXT_GROUP_SIZE);
  type ItemWithCard = (typeof items)[number];

  try {
    for (const chunkItems of itemChunks) {
      const context = await browser.newContext();
      try {
        for (let i = 0; i < chunkItems.length; i++) {
          const item = chunkItems[i] as ItemWithCard;
          const itemIndex = items.indexOf(item) + 1;
          await taskLogger.log(
            LOG_STEPS.ITEM_START,
            `开始处理第 ${itemIndex}/${items.length} 项`,
            undefined,
            item.id
          );

          await prisma.automationTaskItem.update({
            where: { id: item.id },
            data: { status: AUTOMATION_TASK_ITEM_STATUS.RUNNING },
          });

          const itemLog = async (
            step: string,
            message: string,
            data?: Record<string, unknown>
          ) => {
            await taskLogger.log(
              step as (typeof LOG_STEPS)[keyof typeof LOG_STEPS],
              message,
              data,
              item.id
            );
          };

          let page: Page | undefined;
          try {
            page = await context.newPage();
            const result = await runner(
              {
                taskId,
                itemId: item.id,
                cardId: item.card.id,
                cardContent: item.card.content,
                presetConfig,
                inputConfig,
                log: itemLog,
              },
              page
            );
            serverLog("info", "runner returned", { taskId, itemId: item.id, _t: Date.now() });

            if (result.success) {
              successCount++;
              await prisma.automationTaskItem.update({
                where: { id: item.id },
                data: {
                  status: AUTOMATION_TASK_ITEM_STATUS.SUCCESS,
                  resultJson: (result.data || {}) as Prisma.InputJsonValue,
                  errorCode: null,
                  errorMessage: null,
                },
              });
              await taskLogger.log(LOG_STEPS.ITEM_COMPLETE, "项目执行成功", undefined, item.id);
              if (isPasswordChange && result.newPassword) {
                await updateCardPassword(item.card.id, item.card.content, result.newPassword);
              }
              if (isChangeRegion && result.newRegion) {
                await updateCardRegion(item.card.id, item.card.content, result.newRegion);
              }
            } else {
              failedCount++;
              await prisma.automationTaskItem.update({
                where: { id: item.id },
                data: {
                  status: AUTOMATION_TASK_ITEM_STATUS.FAILED,
                  errorCode: result.errorCode || "UNKNOWN",
                  errorMessage: result.errorMessage || "执行失败",
                  retryCount: { increment: 1 },
                },
              });
              await taskLogger.error(
                LOG_STEPS.ITEM_FAILED,
                result.errorMessage || "项目执行失败",
                { errorCode: result.errorCode },
                item.id
              );
              serverLog("error", "item failed", {
                taskId,
                itemId: item.id,
                errorCode: result.errorCode ?? "UNKNOWN",
                error: (result.errorMessage || "项目执行失败").slice(0, 200),
              });
            }
          } catch (err) {
            failedCount++;
            await prisma.automationTaskItem.update({
              where: { id: item.id },
              data: {
                status: AUTOMATION_TASK_ITEM_STATUS.FAILED,
                errorCode: "EXCEPTION",
                errorMessage: err instanceof Error ? err.message : "未知异常",
                retryCount: { increment: 1 },
              },
            });
            await taskLogger.error(
              LOG_STEPS.ITEM_FAILED,
              err instanceof Error ? err.message : "未知异常",
              { errorCode: "EXCEPTION" },
              item.id
            );
            serverLog("error", "item exception", {
              taskId,
              itemId: item.id,
              errorCode: "EXCEPTION",
              error: (err instanceof Error ? err.message : String(err)).slice(0, 200),
            });
          } finally {
            if (page) await page.close();
            serverLog("info", "page closed", { taskId, itemId: item.id, _t: Date.now() });
          }
        }
      } finally {
        await context.close();
        serverLog("info", "context closed", { taskId, _t: Date.now() });
      }
    }
  } finally {
    serverLog("info", "browser closing", { taskId });
    await browser.close();
    serverLog("info", "browser closed", { taskId, _t: Date.now() });
  }

  let finalStatus: (typeof AUTOMATION_TASK_STATUS)[keyof typeof AUTOMATION_TASK_STATUS];
  if (failedCount === 0) {
    finalStatus = AUTOMATION_TASK_STATUS.SUCCESS;
  } else if (successCount === 0) {
    finalStatus = AUTOMATION_TASK_STATUS.FAILED;
  } else {
    finalStatus = AUTOMATION_TASK_STATUS.PARTIAL_SUCCESS;
  }

  const remainingPending = await prisma.automationTaskItem.count({
    where: { taskId, status: AUTOMATION_TASK_ITEM_STATUS.PENDING },
  });

  if (remainingPending > 0) {
    finalStatus = AUTOMATION_TASK_STATUS.RUNNING;
  }

  await prisma.automationTask.update({
    where: { id: taskId },
    data: {
      status: finalStatus,
      summary: {
        lastRunAt: new Date().toISOString(),
        processed: items.length,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
      } as Prisma.InputJsonValue,
    },
  });

  await taskLogger.log(LOG_STEPS.TASK_COMPLETE, `任务执行完成：成功 ${successCount}，失败 ${failedCount}`, {
    success: successCount,
    failed: failedCount,
    skipped: skippedCount,
    finalStatus,
  });

  serverLog("info", "run finished", {
    taskId,
    successCount,
    failedCount,
    finalStatus,
    durationMs: Date.now() - runStartAt,
  });

  return NextResponse.json({
    message: "任务执行完成",
    processed: items.length,
    success: successCount,
    failed: failedCount,
    skipped: skippedCount,
    status: finalStatus,
  });
}

async function updateCardPassword(
  cardId: string,
  oldContent: string,
  newPassword: string
): Promise<void> {
  const parsed = parseFreeSharedCardContent(oldContent);

  let newContent: string;

  if (parsed) {
    const updated: FreeSharedCardPayload = {
      ...parsed,
      password: newPassword,
    };
    newContent = toCardContentJson(updated);
  } else {
    const parts = oldContent.split(/[:\s]+/);
    if (parts.length >= 2) {
      parts[1] = newPassword;
      newContent = parts.join(":");
    } else {
      newContent = `${oldContent}:${newPassword}`;
    }
  }

  await prisma.card.update({
    where: { id: cardId },
    data: { content: newContent },
  });
}

async function updateCardRegion(
  cardId: string,
  oldContent: string,
  newRegion: string
): Promise<void> {
  const parsed = parseFreeSharedCardContent(oldContent);

  let newContent: string;

  if (parsed) {
    const updated: FreeSharedCardPayload = {
      ...parsed,
      region: newRegion,
    };
    newContent = toCardContentJson(updated);
  } else {
    newContent = oldContent;
  }

  await prisma.card.update({
    where: { id: cardId },
    data: { content: newContent },
  });
}

export const runtime = "nodejs";
