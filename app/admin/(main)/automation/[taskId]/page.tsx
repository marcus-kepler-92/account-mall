import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { AUTOMATION_CATEGORY } from "@/lib/automation/constants";
import { getCardContentFirstSegment } from "@/lib/free-shared-card";
import { TaskItemsTable } from "./task-items-table";
import { RunTaskButton } from "./run-task-button";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ taskId: string }>;
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

export default async function AutomationTaskDetailPage({ params }: PageProps) {
  const { taskId } = await params;

  const task = await prisma.automationTask.findUnique({
    where: { id: taskId },
    include: {
      product: { select: { id: true, name: true } },
      preset: { select: { id: true, name: true, presetKey: true, presetType: true } },
      items: {
        include: {
          card: { select: { id: true, content: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!task || task.category !== AUTOMATION_CATEGORY.APPLE) {
    notFound();
  }

  const itemStats = {
    pending: 0,
    running: 0,
    success: 0,
    failed: 0,
  };

  for (const item of task.items) {
    switch (item.status) {
      case "PENDING":
        itemStats.pending++;
        break;
      case "RUNNING":
        itemStats.running++;
        break;
      case "SUCCESS":
        itemStats.success++;
        break;
      case "FAILED":
        itemStats.failed++;
        break;
    }
  }

  const statusInfo = statusMap[task.status] || statusMap.PENDING;
  const presetLabel = presetTypeMap[task.preset.presetType] || task.preset.presetType;

  const contentDelimiter = (task.inputConfig as Record<string, unknown> | null)?.contentDelimiter as
    | string
    | undefined;
  const serializedItems = task.items.map((item) => ({
    id: item.id,
    cardId: item.cardId,
    cardContent: item.card.content,
    cardContentMasked:
      item.card.content.length > 8 ? item.card.content.slice(0, 8) + "***" : item.card.content,
    cardContentFirstSegment: getCardContentFirstSegment(item.card.content, contentDelimiter),
    status: item.status,
    errorCode: item.errorCode,
    errorMessage: item.errorMessage,
    retryCount: item.retryCount,
    resultJson: item.resultJson as Record<string, unknown> | null,
    updatedAt: item.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/automation">
            <ArrowLeft className="size-4" />
            返回列表
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">任务详情</h2>
          <p className="text-muted-foreground">
            {task.product.name} · {presetLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RunTaskButton
            taskId={task.id}
            presetType={task.preset.presetType}
            hasPending={itemStats.pending > 0}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>状态</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={statusInfo.className}>
              {statusInfo.label}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总数</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{task.items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>成功</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{itemStats.success}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>失败</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{itemStats.failed}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>执行明细</CardTitle>
          <CardDescription>
            每条卡密的执行状态与结果
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskItemsTable
            taskId={task.id}
            items={serializedItems}
            presetType={task.preset.presetType}
          />
        </CardContent>
      </Card>
    </div>
  );
}
