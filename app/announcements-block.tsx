"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownViewClient } from "@/app/components/markdown-view-client";

function ContentSkeleton({ lines = 5 }: { lines?: number }) {
  const widths = ["w-full", "w-4/5", "w-3/4", "w-full", "w-2/3"];
  return (
    <div className="space-y-2 py-1">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

function CollapsibleMarkdownContent({ content }: { content: string }) {
  return <MarkdownViewClient content={content} />;
}

const ModalMarkdownView = dynamic(
  () => import("@/app/components/markdown-view").then((m) => m.MarkdownView),
  { ssr: false, loading: () => <ContentSkeleton /> },
);

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

function ModalContent({ announcement }: { announcement: FrontAnnouncement }) {
  return (
    <div className="max-h-96 overflow-y-auto text-sm">
      {announcement.content?.trim() ? (
        <ModalMarkdownView content={announcement.content} />
      ) : (
        <p className="text-muted-foreground text-center py-4">此公告无详细内容</p>
      )}
    </div>
  );
}

// useSyncExternalStore pattern: server snapshot = false, client snapshot = true
// This ensures the dialog is never open in SSR output, so it doesn't affect LCP.
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function AnnouncementsBlock({ announcements }: AnnouncementsBlockProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const isClient = useIsClient();

  const modalOpen = isClient && !dismissed && announcements.length > 0;

  const toggleExpanded = (id: string, open: boolean) => {
    setExpandedIds((prev) =>
      open ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  if (!announcements.length) return null;

  const current = announcements[currentIndex];
  const total = announcements.length;

  return (
    <>
      {/*
        modal={false} + a pointer-events-none custom overlay so the AI
        customer-service FAB beneath the dim mask stays clickable. The
        default shadcn DialogContent always pairs with a pointer-events:
        auto overlay AND Radix sets pointer-events:none on the body when
        modal=true — together that visibly shows the FAB but blocks
        every click on it. Compose manually here instead of touching
        the shared shadcn primitive.
      */}
      <Dialog
        modal={false}
        open={modalOpen}
        onOpenChange={(open) => { if (!open) setDismissed(true) }}
      >
        <DialogPortal>
          <div
            aria-hidden
            data-state={modalOpen ? "open" : "closed"}
            className="fixed inset-0 z-50 bg-black/50 pointer-events-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
          />
          <DialogPrimitive.Content
            className="fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] sm:max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="size-4 text-primary" aria-hidden />
                {current.title}
              </DialogTitle>
              {current.publishedAt && (
                <DialogDescription>{formatDate(current.publishedAt)}</DialogDescription>
              )}
            </DialogHeader>

            <ModalContent key={currentIndex} announcement={current} />

            {total > 1 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => i - 1)}
                  aria-label="上一条公告"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentIndex + 1} / {total}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={currentIndex === total - 1}
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  aria-label="下一条公告"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}

            <DialogPrimitive.Close
              className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <XIcon />
              <span className="sr-only">关闭</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

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
                    onOpenChange={(openState) => toggleExpanded(a.id, openState)}
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
                        <CollapsibleMarkdownContent content={a.content!} />
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
    </>
  );
}
