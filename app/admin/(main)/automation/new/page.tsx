import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTaskForm } from "./create-task-form";

export const dynamic = "force-dynamic";

export default async function NewAutomationTaskPage() {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">创建自动化任务</h2>
        <p className="text-muted-foreground">
          选择商品和任务类型，批量执行 Apple 账号操作
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>任务配置</CardTitle>
          <CardDescription>
            选择要操作的商品，然后选择预设的自动化任务类型
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTaskForm products={products} />
        </CardContent>
      </Card>
    </div>
  );
}
