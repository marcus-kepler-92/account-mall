"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2 } from "lucide-react";

type Task = {
  id: string;
  product: { id: string; name: string };
  preset: { id: string; name: string; presetType: string };
  inputConfig: Record<string, unknown> | null;
  initialCardIds: string[];
  cards: { id: string; maskedContent: string }[];
};

type Props = {
  task: Task;
};

export function EditTaskForm({ task }: Props) {
  const router = useRouter();
  const inputConfig = (task.inputConfig as Record<string, unknown>) || {};
  const [contentDelimiter, setContentDelimiter] = useState(
    (inputConfig.contentDelimiter as string) ?? ""
  );
  const [targetRegion, setTargetRegion] = useState(
    (inputConfig.targetRegion as string) ?? "US"
  );
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    () => new Set(task.initialCardIds)
  );
  const [submitting, setSubmitting] = useState(false);

  const isChangeRegion = task.preset.presetType === "CHANGE_REGION";

  const handleToggleCard = (cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selectedCardIds.size === task.cards.length) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(task.cards.map((c) => c.id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCardIds.size === 0) {
      toast.error("请至少保留一条卡密");
      return;
    }
    setSubmitting(true);
    try {
      const inputConfigPayload: Record<string, unknown> = {
        contentDelimiter: contentDelimiter.trim(),
        ...(isChangeRegion && { targetRegion: targetRegion.trim() || "US" }),
      };

      const res = await fetch(`/api/automation/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputConfig: inputConfigPayload,
          cardIds: Array.from(selectedCardIds),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("任务已更新");
        router.push(`/admin/automation/${task.id}`);
        router.refresh();
      } else {
        toast.error(data.error || "更新失败");
      }
    } catch {
      toast.error("更新失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2 max-w-md">
        <Label htmlFor="contentDelimiter" className="text-base font-medium">
          卡密分隔符（可选）
        </Label>
        <input
          id="contentDelimiter"
          type="text"
          value={contentDelimiter}
          onChange={(e) => setContentDelimiter(e.target.value)}
          placeholder="留空自动识别，或输入如 ----、:、|"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          若卡密格式为「账号----密码----其他」，可填写分隔符以正确提取账号和密码
        </p>
      </div>

      {isChangeRegion && (
        <div className="space-y-2 max-w-md">
          <Label htmlFor="targetRegion" className="text-base font-medium">
            目标地区
          </Label>
          <input
            id="targetRegion"
            type="text"
            value={targetRegion}
            onChange={(e) => setTargetRegion(e.target.value)}
            placeholder="如 US、CN"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">卡密</Label>
          {task.cards.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={handleToggleAll}>
              {selectedCardIds.size === task.cards.length ? "取消全选" : "全选"}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          已选 {selectedCardIds.size} 条，仅可取消待执行项或勾选本商品未售卡密
        </p>
        {task.cards.length > 0 ? (
          <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
            {task.cards.map((card) => (
              <label
                key={card.id}
                className="flex items-center gap-3 p-3 hover:bg-accent/50 cursor-pointer"
              >
                <Checkbox
                  checked={selectedCardIds.has(card.id)}
                  onCheckedChange={() => handleToggleCard(card.id)}
                />
                <span className="font-mono text-sm">{card.maskedContent}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">该商品暂无卡密</p>
        )}
      </div>

      <div className="flex items-center gap-4 pt-4 border-t">
        <Button type="submit" disabled={submitting || selectedCardIds.size === 0}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              保存中...
            </>
          ) : (
            "保存"
          )}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/admin/automation/${task.id}`}>
            <ArrowLeft className="size-4" />
            返回详情
          </Link>
        </Button>
      </div>
    </form>
  );
}
