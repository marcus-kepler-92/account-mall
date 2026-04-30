"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 400);
    return () => clearTimeout(t);
  }, []);

  return showSkeleton ? (
    <ContentSkeleton lines={3} />
  ) : (
    <MarkdownViewClient content={content} />
  );
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
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="max-h-96 overflow-y-auto text-sm">
      {showSkeleton ? (
        <ContentSkeleton />
      ) : announcement.content?.trim() ? (
        <ModalMarkdownView content={announcement.content} />
      ) : (
        <p className="text-muted-foreground text-center py-4">此公告无详细内容</p>
      )}
    </div>
  );
}

export function AnnouncementsBlock({ announcements }: AnnouncementsBlockProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(true);

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
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="max-w-lg"
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
        </DialogContent>
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
