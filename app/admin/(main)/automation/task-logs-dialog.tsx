"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskLogsTimeline } from "./task-logs-timeline";

type Props = {
  taskId: string | null;
  taskName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TaskLogsDialog({ taskId, taskName, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>任务日志 - {taskName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2">
          {taskId && <TaskLogsTimeline taskId={taskId} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
