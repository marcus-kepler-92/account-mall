"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Pencil, Play, Loader2, FileText } from "lucide-react";
import { TaskLogsDialog } from "./task-logs-dialog";
import { UrlPagination } from "../../components/url-pagination";

type TaskRow = {
  id: string;
  product: { id: string; name: string };
  preset: { id: string; name: string; presetKey: string; presetType: string };
  status: string;
  createdBy: string;
  createdAt: string;
  itemCount: number;
  itemStats: {
    pending: number;
    running: number;
    success: number;
    failed: number;
  };
};

type Props = {
  data: TaskRow[];
  total: number;
  page: number;
  pageSize: number;
  products: { id: string; name: string }[];
  currentProductId?: string;
};

const statusMap: Record<string, { label: string; className: string }> = {
  PENDING: { label: "待执行", className: "border-warning/50 bg-warning/10 text-warning" },
  RUNNING: { label: "执行中", className: "border-primary/50 bg-primary/10 text-primary" },
  SUCCESS: { label: "成功", className: "border-success/50 bg-success/10 text-success" },
  PARTIAL_SUCCESS: { label: "部分成功", className: "border-warning/50 bg-warning/10 text-warning" },
  FAILED: { label: "失败", className: "border-destructive/50 bg-destructive/10 text-destructive" },
};

const presetTypeMap: Record<string, string> = {
  STATUS_TEST: "状态测试",
  CHANGE_PASSWORD: "改密",
  CHANGE_REGION: "改地区",
};

export function AutomationTasksTable({
  data,
  total,
  page,
  pageSize,
  products,
  currentProductId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [executing, setExecuting] = useState(false);
  const [logDialogTask, setLogDialogTask] = useState<{ id: string; name: string } | null>(null);

  const executableTasks = data.filter(
    (t) => t.status !== "RUNNING" && t.itemStats.pending > 0
  );
  const allExecutableSelected =
    executableTasks.length > 0 &&
    executableTasks.every((t) => selectedIds.has(t.id));

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

  const handleToggleAll = () => {
    if (allExecutableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(executableTasks.map((t) => t.id)));
    }
  };

  const handleBatchRun = async () => {
    const taskIds = Array.from(selectedIds).filter((id) => {
      const task = data.find((t) => t.id === id);
      return task && task.status !== "RUNNING" && task.status !== "SUCCESS";
    });

    if (taskIds.length === 0) {
      toast.error("没有可执行的任务");
      return;
    }

    setExecuting(true);
    try {
      const res = await fetch("/api/automation/tasks/batch-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success(result.message);
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast.error(result.error || "批量执行失败");
      }
    } catch {
      toast.error("批量执行失败");
    } finally {
      setExecuting(false);
    }
  };

  const canExecuteTask = (task: TaskRow) => {
    return task.status !== "RUNNING" && task.itemStats.pending > 0;
  };

  const buildUrl = (newParams: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(newParams)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    return `/admin/automation?${params.toString()}`;
  };

  const handleProductChange = (value: string) => {
    router.push(buildUrl({ productId: value === "ALL" ? undefined : value, page: "1" }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Select value={currentProductId || "ALL"} onValueChange={handleProductChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="筛选商品" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="ALL">全部商品</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedIds.size > 0 && (
          <Button
            onClick={handleBatchRun}
            disabled={executing}
            size="sm"
          >
            {executing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                执行中...
              </>
            ) : (
              <>
                <Play className="size-4" />
                批量执行 ({selectedIds.size})
              </>
            )}
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allExecutableSelected && executableTasks.length > 0}
                  onCheckedChange={handleToggleAll}
                  disabled={executableTasks.length === 0}
                />
              </TableHead>
              <TableHead>商品</TableHead>
              <TableHead>任务类型</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>进度</TableHead>
              <TableHead>创建者</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((task) => {
              const statusInfo = statusMap[task.status] || statusMap.PENDING;
              const presetLabel = presetTypeMap[task.preset.presetType] || task.preset.presetType;
              const progressPercent =
                task.itemCount > 0
                  ? Math.round(
                      ((task.itemStats.success + task.itemStats.failed) / task.itemCount) * 100
                    )
                  : 0;

              const isExecutable = canExecuteTask(task);

              return (
                <TableRow key={task.id}>
                  <TableCell>
                    {isExecutable ? (
                      <Checkbox
                        checked={selectedIds.has(task.id)}
                        onCheckedChange={() => handleToggle(task.id)}
                      />
                    ) : (
                      <Checkbox disabled checked={false} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/products/${task.product.id}`}
                      className="font-medium hover:underline"
                    >
                      {task.product.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{presetLabel}</Badge>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {task.preset.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusInfo.className}>
                      {statusInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 w-24 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {task.itemStats.success}/{task.itemCount}
                        {task.itemStats.failed > 0 && (
                          <span className="text-destructive ml-1">
                            ({task.itemStats.failed}失败)
                          </span>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {task.createdBy}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(task.createdAt).toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link href={`/admin/automation/${task.id}/edit`}>
                          <Pencil className="size-4" />
                          编辑
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLogDialogTask({ id: task.id, name: `${task.product.name} - ${presetLabel}` })}
                      >
                        <FileText className="size-4" />
                        日志
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/automation/${task.id}`}>
                          <Eye className="size-4" />
                          详情
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  没有符合条件的任务
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TaskLogsDialog
        taskId={logDialogTask?.id ?? null}
        taskName={logDialogTask?.name ?? ""}
        open={!!logDialogTask}
        onOpenChange={(open) => !open && setLogDialogTask(null)}
      />

      <UrlPagination total={total} />
    </div>
  );
}
