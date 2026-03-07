import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { AUTOMATION_CATEGORY } from "@/lib/automation/constants";
import { EditTaskForm } from "./edit-task-form";

export const dynamic = "force-dynamic";

const maskContent = (content: string) =>
  content.length > 8 ? content.slice(0, 8) + "***" : content;

type PageProps = {
  params: Promise<{ taskId: string }>;
};

export default async function EditAutomationTaskPage({ params }: PageProps) {
  const { taskId } = await params;

  const task = await prisma.automationTask.findUnique({
    where: { id: taskId },
    include: {
      product: { select: { id: true, name: true } },
      preset: { select: { id: true, name: true, presetType: true } },
      items: {
        include: {
          card: { select: { id: true, content: true } },
        },
      },
    },
  });

  if (!task || task.category !== AUTOMATION_CATEGORY.APPLE) {
    notFound();
  }

  const taskCardIds = new Set(task.items.map((i) => i.card.id));
  const unsoldCards = await prisma.card.findMany({
    where: { productId: task.productId, status: "UNSOLD" },
    select: { id: true, content: true },
  });

  const cardsMap = new Map<string, { id: string; maskedContent: string }>();
  for (const i of task.items) {
    cardsMap.set(i.card.id, { id: i.card.id, maskedContent: maskContent(i.card.content) });
  }
  for (const c of unsoldCards) {
    if (!cardsMap.has(c.id)) {
      cardsMap.set(c.id, { id: c.id, maskedContent: maskContent(c.content) });
    }
  }
  const cards = Array.from(cardsMap.values());

  const serializedTask = {
    id: task.id,
    product: task.product,
    preset: task.preset,
    inputConfig: task.inputConfig as Record<string, unknown> | null,
    initialCardIds: task.items.map((i) => i.card.id),
    cards,
  };

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

      <div>
        <h2 className="text-2xl font-bold tracking-tight">编辑任务</h2>
        <p className="text-muted-foreground">
          {task.product.name} · {task.preset.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>任务配置</CardTitle>
          <CardDescription>
            修改输入配置与要执行的卡密（仅可取消待执行项或增加未售卡密）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditTaskForm task={serializedTask} />
        </CardContent>
      </Card>
    </div>
  );
}
