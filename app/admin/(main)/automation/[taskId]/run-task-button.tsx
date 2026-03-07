"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Play, Loader2, CheckCircle } from "lucide-react";

type Props = {
  taskId: string;
  presetType: string;
  hasPending: boolean;
};

export function RunTaskButton({ taskId, hasPending }: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/automation/tasks/${taskId}/run`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "任务已开始执行");
        router.refresh();
      } else {
        toast.error(data.error || "执行失败");
      }
    } catch {
      toast.error("执行失败");
    } finally {
      setRunning(false);
    }
  };

  if (!hasPending) {
    return (
      <Button disabled variant="outline">
        <CheckCircle className="size-4" />
        无待执行项
      </Button>
    );
  }

  return (
    <Button onClick={handleRun} disabled={running}>
      {running ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          执行中...
        </>
      ) : (
        <>
          <Play className="size-4" />
          执行待处理项
        </>
      )}
    </Button>
  );
}
