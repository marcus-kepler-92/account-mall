"use client";

import { useSyncExternalStore } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownViewClient } from "@/app/components/markdown-view-client";

const STORAGE_KEY = "announcements-expanded";

export type FrontAnnouncement = {
  id: string;
  title: string;
  content: string | null;
  publishedAt: string | null;
};

type AnnouncementsBlockProps = {
  announcements: FrontAnnouncement[];
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getDefaultExpandedId(
  announcements: FrontAnnouncement[],
): string | null {
  const firstWithContent = announcements.find((x) => x.content?.trim());
  return firstWithContent?.id ?? null;
}

// Cache parsed snapshot to keep reference stable between renders.
let cachedRaw: string | null = undefined as unknown as string | null;
let cachedIds: string[] = [];

function readSnapshot(defaultIds: string[]): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        cachedIds = Array.isArray(parsed) && parsed.every((x) => typeof x === "string")
          ? (parsed as string[])
          : defaultIds;
      } else {
        cachedIds = defaultIds;
      }
    }
    return cachedIds;
  } catch {
    return defaultIds;
  }
}

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function AnnouncementsBlock({ announcements }: AnnouncementsBlockProps) {
  const defaultIds: string[] = (() => {
    const id = getDefaultExpandedId(announcements);
    return id ? [id] : [];
  })();

  const expandedIds = useSyncExternalStore(
    subscribeToStorage,
    () => readSnapshot(defaultIds),
    () => defaultIds,
  );

  const setExpanded = (id: string, open: boolean) => {
    const next = open
      ? expandedIds.includes(id) ? expandedIds : [...expandedIds, id]
      : expandedIds.filter((x) => x !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // storage event doesn't fire in the same tab — dispatch manually
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    } catch {
      // ignore
    }
  };

  if (!announcements.length) return null;

  return (
    <section
      className="mb-10 animate-in fade-in duration-300"
      aria-label="站内公告"
    >
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Megaphone className="size-5 text-primary" aria-hidden />
        公告
      </h2>
      <ul className="space-y-3">
        {announcements.map((a) => {
          const hasContent = !!a.content?.trim();
          const open = expandedIds.includes(a.id);
          return (
            <li
              key={a.id}
              className={cn(
                "rounded-lg border bg-muted/50 shadow-sm transition-shadow hover:shadow",
                "animate-in fade-in duration-200",
              )}
            >
              {hasContent ? (
                <Collapsible
                  className="group"
                  open={open}
                  onOpenChange={(openState) => setExpanded(a.id, openState)}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 rounded-lg transition-colors">
                    <span className="font-medium text-foreground">
                      {a.title}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      {a.publishedAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(a.publishedAt)}
                        </span>
                      )}
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border bg-card px-8 py-3 text-sm text-muted-foreground rounded-b-lg">
                      <MarkdownViewClient content={a.content!} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-medium text-foreground">{a.title}</span>
                  {a.publishedAt && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDate(a.publishedAt)}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
