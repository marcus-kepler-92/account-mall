import * as z from "zod";
import {
  AUTOMATION_CATEGORY,
  APPLE_PRESET_KEYS,
  AUTOMATION_TASK_STATUS,
} from "./constants";

const MAX_BATCH_CARDS = 100;

export const createAutomationTaskSchema = z.object({
  productId: z.string().min(1),
  presetId: z.string().min(1),
  cardIds: z
    .array(z.string().min(1))
    .min(1, "At least one card is required")
    .max(MAX_BATCH_CARDS, `Maximum ${MAX_BATCH_CARDS} cards per task`),
  inputConfig: z.record(z.unknown()).optional(),
});

export type CreateAutomationTaskInput = z.infer<
  typeof createAutomationTaskSchema
>;

export const automationTaskListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      AUTOMATION_TASK_STATUS.PENDING,
      AUTOMATION_TASK_STATUS.RUNNING,
      AUTOMATION_TASK_STATUS.SUCCESS,
      AUTOMATION_TASK_STATUS.PARTIAL_SUCCESS,
      AUTOMATION_TASK_STATUS.FAILED,
      "ALL",
    ])
    .optional()
    .default("ALL"),
  productId: z.string().optional(),
  presetKey: z
    .enum([
      APPLE_PRESET_KEYS.STATUS_TEST_BASIC,
      APPLE_PRESET_KEYS.PASSWORD_CHANGE_V1,
      APPLE_PRESET_KEYS.CHANGE_REGION_V1,
      "ALL",
    ])
    .optional()
    .default("ALL"),
});

export type AutomationTaskListQuery = z.infer<
  typeof automationTaskListQuerySchema
>;

export const retryAutomationTaskSchema = z.object({
  itemIds: z
    .array(z.string().min(1))
    .min(1, "At least one item is required")
    .max(MAX_BATCH_CARDS, `Maximum ${MAX_BATCH_CARDS} items per retry`)
    .optional(),
});

export const updateAutomationTaskSchema = z.object({
  inputConfig: z.record(z.unknown()).optional(),
  summary: z.unknown().optional(),
  cardIds: z.array(z.string().min(1)).min(0).max(MAX_BATCH_CARDS).optional(),
});

export type RetryAutomationTaskInput = z.infer<
  typeof retryAutomationTaskSchema
>;

export function isValidAppleCategory(
  category: unknown
): category is typeof AUTOMATION_CATEGORY.APPLE {
  return category === AUTOMATION_CATEGORY.APPLE;
}
