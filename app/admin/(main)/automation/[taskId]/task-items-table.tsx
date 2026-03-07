"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RotateCcw, Loader2, Eye } from "lucide-react";
import { TaskLogsTimeline } from "../task-logs-timeline";

type TaskItem = {
  id: string;
  cardId: string;
  cardContent: string;
  cardContentMasked: string;
  cardContentFirstSegment: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  resultJson: Record<string, unknown> | null;
  updatedAt: string;
};

type Props = {
  taskId: string;
  items: TaskItem[];
  presetType?: string;
};

const itemStatusMap: Record<string, { label: string; className: string }> = {
  PENDING: { label: "待执行", className: "border-warning/50 bg-warning/10 text-warning" },
  RUNNING: { label: "执行中", className: "border-primary/50 bg-primary/10 text-primary" },
  SUCCESS: { label: "成功", className: "border-success/50 bg-success/10 text-success" },
  FAILED: { label: "失败", className: "border-destructive/50 bg-destructive/10 text-destructive" },
};

export function TaskItemsTable({ taskId, items }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState(false);
  const [viewItem, setViewItem] = useState<TaskItem | null>(null);

  const failedItems = items.filter((i) => i.status === "FAILED");
  const canRetry = failedItems.length > 0;

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleAllFailed = () => {
    const failedIds = failedItems.map((i) => i.id);
    const allSelected = failedIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(failedIds));
    }
  };

  const handleRetry = async () => {
    const idsToRetry = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;

    setRetrying(true);
    try {
      const res = await fetch(`/api/automation/tasks/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: idsToRetry }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`已重置 ${data.retriedCount} 条为待执行`);
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast.error(data.error || "重试失败");
      }
    } catch {
      toast.error("重试失败");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-4">
      {canRetry && (
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleAllFailed}
            disabled={retrying}
          >
            {failedItems.every((i) => selectedIds.has(i.id)) ? "取消全选失败项" : "全选失败项"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            {selectedIds.size > 0 ? `重试选中 (${selectedIds.size})` : "重试全部失败项"}
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {canRetry && <TableHead className="w-10" />}
              <TableHead>账号</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>错误信息</TableHead>
              <TableHead>重试次数</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const statusInfo = itemStatusMap[item.status] || itemStatusMap.PENDING;
              const isFailed = item.status === "FAILED";

              return (
                <TableRow key={item.id}>
                  {canRetry && (
                    <TableCell>
                      {isFailed && (
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => handleToggle(item.id)}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm">
                    {item.cardContentFirstSegment}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusInfo.className}>
                      {statusInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {item.errorMessage || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.retryCount}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(item.updatedAt).toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewItem(item)}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] min-h-[480px] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>执行详情</DialogTitle>
            <DialogDescription>
              账号: {viewItem?.cardContentFirstSegment}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
            <div>
              <div className="text-sm font-medium mb-1">状态</div>
              <Badge
                variant="outline"
                className={itemStatusMap[viewItem?.status || "PENDING"]?.className}
              >
                {itemStatusMap[viewItem?.status || "PENDING"]?.label}
              </Badge>
            </div>
            {viewItem?.errorCode && (
              <div>
                <div className="text-sm font-medium mb-1">错误码</div>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {viewItem.errorCode}
                </code>
              </div>
            )}
            {viewItem?.errorMessage && (
              <div>
                <div className="text-sm font-medium mb-1">错误信息</div>
                <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                  {viewItem.errorMessage}
                </div>
              </div>
            )}
            {viewItem?.resultJson && (
              <div>
                <div className="text-sm font-medium mb-1">结果数据</div>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                  {JSON.stringify(viewItem.resultJson, null, 2)}
                </pre>
              </div>
            )}
            {viewItem && (
              <div className="min-h-[280px] flex flex-col">
                <div className="text-sm font-medium mb-2">该项执行日志</div>
                <div className="rounded-md border bg-muted/30 p-3 min-h-[240px] flex-1 overflow-auto">
                  <TaskLogsTimeline taskId={taskId} itemId={viewItem.id} />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
