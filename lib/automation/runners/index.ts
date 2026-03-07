import type { RunnerFn, RunnerContext, RunnerResult } from "./types";
import { runAppleStatusTest } from "./apple-status-test";
import { runApplePasswordChange } from "./apple-password-change";
import { runAppleChangeRegion } from "./apple-change-region";

export type { RunnerContext, RunnerResult, RunnerFn } from "./types";

const runnerMap: Record<string, RunnerFn> = {
  "apple.status_test.basic": runAppleStatusTest,
  "apple.password_change.v1": runApplePasswordChange,
  "apple.change_region.v1": runAppleChangeRegion,
};

export function getRunner(adapterKey: string): RunnerFn | null {
  return runnerMap[adapterKey] ?? null;
}

export function getSupportedAdapterKeys(): string[] {
  return Object.keys(runnerMap);
}
