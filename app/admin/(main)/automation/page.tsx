import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Plus, Bot, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { AUTOMATION_CATEGORY } from "@/lib/automation/constants";
import { AutomationTasksTable } from "./automation-tasks-table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  page?: string;
  pageSize?: string;
  status?: string;
  productId?: string;
}>;

export default async function AutomationTasksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || "20", 10) || 20));
  const statusFilter = params.status || "ALL";
  const productIdFilter = params.productId;

  const where: Record<string, unknown> = {
    category: AUTOMATION_CATEGORY.APPLE,
  };

  if (statusFilter !== "ALL") {
    where.status = statusFilter;
  }
  if (productIdFilter) {
    where.productId = productIdFilter;
  }

  const [tasks, total, statusCounts, products] = await Promise.all([
    prisma.automationTask.findMany({
      where,
      include: {
        product: { select: { id: true, name: true } },
        preset: { select: { id: true, name: true, presetKey: true, presetType: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.automationTask.count({ where }),
    prisma.automationTask.groupBy({
      by: ["status"],
      where: { category: AUTOMATION_CATEGORY.APPLE },
      _count: { id: true },
    }),
    prisma.product.findMany({
      where: {
        automationTasks: { some: { category: AUTOMATION_CATEGORY.APPLE } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const taskIds = tasks.map((t) => t.id);
  const itemStats = await prisma.automationTaskItem.groupBy({
    by: ["taskId", "status"],
    where: { taskId: { in: taskIds } },
    _count: { id: true },
  });

  const statsMap = new Map<string, Record<string, number>>();
  for (const stat of itemStats) {
    if (!statsMap.has(stat.taskId)) {
      statsMap.set(stat.taskId, {});
    }
    statsMap.get(stat.taskId)![stat.status] = stat._count.id;
  }

  const serializedTasks = tasks.map((task) => {
    const stats = statsMap.get(task.id) || {};
    return {
      id: task.id,
      product: task.product,
      preset: task.preset,
      status: task.status,
      createdBy: task.createdBy,
      createdAt: task.createdAt.toISOString(),
      itemCount: task._count.items,
      itemStats: {
        pending: stats["PENDING"] ?? 0,
        running: stats["RUNNING"] ?? 0,
        success: stats["SUCCESS"] ?? 0,
        failed: stats["FAILED"] ?? 0,
      },
    };
  });

  const stats = {
    PENDING: statusCounts.find((c) => c.status === "PENDING")?._count.id ?? 0,
    RUNNING: statusCounts.find((c) => c.status === "RUNNING")?._count.id ?? 0,
    SUCCESS: statusCounts.find((c) => c.status === "SUCCESS")?._count.id ?? 0,
    PARTIAL_SUCCESS: statusCounts.find((c) => c.status === "PARTIAL_SUCCESS")?._count.id ?? 0,
    FAILED: statusCounts.find((c) => c.status === "FAILED")?._count.id ?? 0,
  };

  const statsTotal = Object.values(stats).reduce((a, b) => a + b, 0);

  const buildStatusLink = (status: string) => {
    const paramsEntries = new URLSearchParams();
    if (status !== "ALL") {
      paramsEntries.set("status", status);
    }
    if (productIdFilter) {
      paramsEntries.set("productId", productIdFilter);
    }
    const query = paramsEntries.toString();
    return `/admin/automation${query ? `?${query}` : ""}`;
  };

  const statCards = [
    {
      key: "PENDING",
      label: "待执行",
      value: stats.PENDING,
      icon: Clock,
      color: "text-warning",
      borderColor: "border-l-warning",
      active: statusFilter === "PENDING",
    },
    {
      key: "RUNNING",
      label: "执行中",
      value: stats.RUNNING,
      icon: Loader2,
      color: "text-primary",
      borderColor: "border-l-primary",
      active: statusFilter === "RUNNING",
    },
    {
      key: "SUCCESS",
      label: "成功",
      value: stats.SUCCESS + stats.PARTIAL_SUCCESS,
      icon: CheckCircle2,
      color: "text-success",
      borderColor: "border-l-success",
      active: statusFilter === "SUCCESS" || statusFilter === "PARTIAL_SUCCESS",
    },
    {
      key: "FAILED",
      label: "失败",
      value: stats.FAILED,
      icon: XCircle,
      color: "text-destructive",
      borderColor: "border-l-destructive",
      active: statusFilter === "FAILED",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">自动化任务</h2>
          <p className="text-muted-foreground">
            Apple 账号状态测试与密码管理
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/automation/new">
            <Plus className="size-4" />
            创建任务
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {statCards.map((stat) => (
          <Link key={stat.key} href={buildStatusLink(stat.active ? "ALL" : stat.key)}>
            <Card
              className={`border-l-4 ${stat.borderColor} transition-colors hover:bg-accent/50 cursor-pointer ${stat.active ? "ring-2 ring-primary/20 bg-accent/30" : ""}`}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <stat.icon className={`size-8 ${stat.color} opacity-80`} />
                </div>
                {statsTotal > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-current ${stat.color}`}
                        style={{ width: `${(stat.value / statsTotal) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {statsTotal > 0 ? ((stat.value / statsTotal) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {serializedTasks.length > 0 || statusFilter !== "ALL" || productIdFilter ? (
        <AutomationTasksTable
          data={serializedTasks}
          total={total}
          page={page}
          pageSize={pageSize}
          products={products}
          currentProductId={productIdFilter}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Bot className="size-8 text-muted-foreground" />
            </div>
            <CardTitle className="mb-2">暂无自动化任务</CardTitle>
            <CardDescription className="mb-4 text-center max-w-sm">
              创建你的第一个自动化任务，批量测试 Apple 账号状态或修改密码。
            </CardDescription>
            <Button asChild>
              <Link href="/admin/automation/new">
                <Plus className="size-4" />
                创建第一个任务
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
