import type { SortingState } from "@tanstack/react-table"
import { parseAsString } from "nuqs"

export type SortDir = "asc" | "desc"

export interface SortDefaults<T extends string> {
  sort: T
  sortDir: SortDir
}

/** nuqs query state shape — import this in each server-side data-table */
export const sortQueryStates = {
  sort: parseAsString,
  sortDir: parseAsString,
}

/**
 * URL params → TanStack SortingState.
 * Empty/null sort → uses default.sort.
 * Invalid sortDir → uses default.sortDir.
 */
export function parseSortingState<T extends string>(
  sort: string | null,
  sortDir: string | null,
  defaults: SortDefaults<T>
): SortingState {
  const id = sort || defaults.sort
  const validDir: SortDir =
    sortDir === "asc" || sortDir === "desc" ? sortDir : defaults.sortDir
  return [{ id, desc: validDir === "desc" }]
}

/**
 * TanStack SortingState → URL params.
 * Returns { sort: null, sortDir: null } when sorting equals defaults
 * so nuqs removes those params from the URL.
 */
export function encodeSortingState<T extends string>(
  sorting: SortingState,
  defaults: SortDefaults<T>
): { sort: string | null; sortDir: string | null } {
  if (sorting.length === 0) return { sort: null, sortDir: null }
  const { id, desc } = sorting[0]
  const dir: SortDir = desc ? "desc" : "asc"
  if (id === defaults.sort && dir === defaults.sortDir) {
    return { sort: null, sortDir: null }
  }
  return { sort: id, sortDir: dir }
}

/**
 * Server-side: validate sort column against whitelist, return Prisma-safe orderBy.
 * Unknown column silently falls back to default — never throws.
 */
export function parseServerSort<T extends string>(
  sort: string | null,
  sortDir: string | null,
  allowed: readonly T[],
  defaults: SortDefaults<T>
): { orderBy: Record<string, SortDir> } {
  const column =
    sort && allowed.includes(sort as T) ? (sort as T) : defaults.sort
  const dir: SortDir =
    sortDir === "asc" || sortDir === "desc" ? sortDir : defaults.sortDir
  return { orderBy: { [column]: dir } }
}
