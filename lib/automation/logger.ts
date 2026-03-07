/**
 * 自动化日志职责划分：
 *
 * 1. 业务日志（本文件）
 *    - 输出：DB 表 AutomationTaskLog
 *    - 用途：管理员在「任务 → 日志」弹窗查看任务/项步骤与结果、审计
 *    - 内容：step + message + level + taskId/itemId；仅「发生了什么业务动作、结果如何」
 *    - 写入方：createTaskLogger / 传入 flow 与 runners 的 log 回调（API 层 + flow/runners）
 *
 * 2. 服务器日志（见 server-log.ts）
 *    - 输出：stdout/stderr（控制台或后续日志服务）
 *    - 用途：运维/排障、监控、运行行为审计
 *    - 内容：任务开始结束、项失败/异常、浏览器生命周期等；仅 ID/计数，不写账号密码等敏感信息
 *    - 写入方：仅 API 层（run、batch-run）在关键节点调用，flow/runners 不写
 */
import { prisma } from "@/lib/prisma";
import { LOG_LEVELS, type LogLevel, type LogStep } from "./constants";

export type LogParams = {
  taskId: string;
  itemId?: string;
  level?: LogLevel;
  step: LogStep;
  message: string;
  data?: Record<string, unknown>;
};

export async function logTask(params: LogParams): Promise<void> {
  const { taskId, itemId, level = LOG_LEVELS.INFO, step, message, data } = params;
  await prisma.automationTaskLog.create({
    data: {
      taskId,
      itemId,
      level,
      step,
      message,
      data: data ?? undefined,
    },
  });
}

export function createTaskLogger(taskId: string) {
  return {
    log: async (
      step: LogStep,
      message: string,
      data?: Record<string, unknown>,
      itemId?: string
    ) => {
      await logTask({ taskId, itemId, level: LOG_LEVELS.INFO, step, message, data });
    },
    warn: async (
      step: LogStep,
      message: string,
      data?: Record<string, unknown>,
      itemId?: string
    ) => {
      await logTask({ taskId, itemId, level: LOG_LEVELS.WARN, step, message, data });
    },
    error: async (
      step: LogStep,
      message: string,
      data?: Record<string, unknown>,
      itemId?: string
    ) => {
      await logTask({ taskId, itemId, level: LOG_LEVELS.ERROR, step, message, data });
    },
  };
}
