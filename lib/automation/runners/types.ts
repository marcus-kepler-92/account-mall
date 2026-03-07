import type { Page } from "playwright";
import type { LogStep } from "../constants";

export type LogFn = (
  step: LogStep,
  message: string,
  data?: Record<string, unknown>
) => Promise<void>;

export type RunnerContext = {
  taskId: string;
  itemId: string;
  cardId: string;
  cardContent: string;
  presetConfig: Record<string, unknown>;
  inputConfig: Record<string, unknown>;
  log: LogFn;
};

export type RunnerResult = {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  data?: Record<string, unknown>;
  newPassword?: string;
  newRegion?: string;
};

/** Runner 接收上下文与 Playwright Page，在 page 上执行自动化后返回结果 */
export type RunnerFn = (ctx: RunnerContext, page: Page) => Promise<RunnerResult>;
