import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { chromium, type Page } from "playwright";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { unauthorized, badRequest } from "@/lib/api-response";
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
import * as z from "zod";

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const batchRunSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(50),
});

type TaskRunResult = {
  taskId: string;
  status: "success" | "skipped" | "error";
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  message?: string;
};

/**
 * POST /api/automation/tasks/batch-run
 * Execute multiple tasks in batch.
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
    return badRequest("Invalid JSON body");
  }

  const parsed = batchRunSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("taskIds 必须是 1-50 个任务 ID 的数组");
  }

  const { taskIds } = parsed.data;

  const tasks = await prisma.automationTask.findMany({
    where: {
      id: { in: taskIds },
      category: AUTOMATION_CATEGORY.APPLE,
    },
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

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const results: TaskRunResult[] = [];

  for (const taskId of taskIds) {
    const task = taskMap.get(taskId);

    if (!task) {
      results.push({
        taskId,
        status: "error",
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        message: "任务不存在",
      });
      continue;
    }

    if (task.status === AUTOMATION_TASK_STATUS.RUNNING) {
      results.push({
        taskId,
        status: "skipped",
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        message: "任务正在执行中",
      });
      continue;
    }

    const runner = getRunner(task.preset.adapterKey);
    if (!runner) {
      results.push({
        taskId,
        status: "error",
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        message: `不支持的适配器: ${task.preset.adapterKey}`,
      });
      continue;
    }

    // Only execute PENDING items - FAILED items must be retried first
    const items = await prisma.automationTaskItem.findMany({
      where: {
        taskId,
        status: AUTOMATION_TASK_ITEM_STATUS.PENDING,
      },
      include: {
        card: { select: { id: true, content: true, productId: true } },
      },
    });

    if (items.length === 0) {
      results.push({
        taskId,
        status: "skipped",
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        message: "没有待执行项（失败项请先重试再执行）",
      });
      continue;
    }

    await prisma.automationTask.update({
      where: { id: taskId },
      data: { status: AUTOMATION_TASK_STATUS.RUNNING },
    });

    const taskLogger = createTaskLogger(taskId);
    const runStartAt = Date.now();

    serverLog("info", "batch run started", {
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
        } as Prisma.InputJsonValue,
      },
    });

    await taskLogger.log(LOG_STEPS.TASK_COMPLETE, `任务执行完成：成功 ${successCount}，失败 ${failedCount}`, {
      success: successCount,
      failed: failedCount,
      finalStatus,
    });

    serverLog("info", "run finished", {
      taskId,
      successCount,
      failedCount,
      finalStatus,
      durationMs: Date.now() - runStartAt,
    });

    results.push({
      taskId,
      status: "success",
      processed: items.length,
      success: successCount,
      failed: failedCount,
      skipped: 0,
    });
  }

  const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
  const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const tasksExecuted = results.filter((r) => r.status === "success").length;
  const tasksSkipped = results.filter((r) => r.status === "skipped").length;

  return NextResponse.json({
    message: `批量执行完成：${tasksExecuted} 个任务已执行，${tasksSkipped} 个跳过`,
    results,
    summary: {
      tasksRequested: taskIds.length,
      tasksExecuted,
      tasksSkipped,
      tasksError: results.filter((r) => r.status === "error").length,
      totalProcessed,
      totalSuccess,
      totalFailed,
    },
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
