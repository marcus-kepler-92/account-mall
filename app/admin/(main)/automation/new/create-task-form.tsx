"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Product = {
  id: string;
  name: string;
  slug: string;
};

type Preset = {
  id: string;
  presetKey: string;
  name: string;
  presetType: string;
};

type Card = {
  id: string;
  content: string;
  maskedContent: string;
  status: string;
};

type Props = {
  products: Product[];
};

export function CreateTaskForm({ products }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [contentDelimiter, setContentDelimiter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedProductId) {
      setPresets([]);
      setSelectedPresetId("");
      return;
    }

    const fetchPresets = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/automation/presets?productId=${selectedProductId}`);
        const data = await res.json();
        if (res.ok) {
          setPresets(data.presets || []);
        } else {
          toast.error(data.error || "获取预设失败");
        }
      } catch {
        toast.error("获取预设失败");
      } finally {
        setLoading(false);
      }
    };

    fetchPresets();
  }, [selectedProductId]);

  useEffect(() => {
    if (!selectedProductId || step < 2) {
      setCards([]);
      setSelectedCardIds(new Set());
      return;
    }

    const fetchCards = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/products/${selectedProductId}/cards?status=UNSOLD`
        );
        const data = await res.json();
        if (res.ok) {
          const cardList = (data.cards || []).map((c: { id: string; content: string }) => ({
            id: c.id,
            content: c.content,
            maskedContent: c.content.length > 8 ? c.content.slice(0, 8) + "***" : c.content,
            status: "UNSOLD",
          }));
          setCards(cardList);
        } else {
          toast.error(data.error || "获取卡密失败");
        }
      } catch {
        toast.error("获取卡密失败");
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, [selectedProductId, step]);

  const handleToggleCard = (cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selectedCardIds.size === cards.length) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(cards.map((c) => c.id)));
    }
  };

  const handleSubmit = async () => {
    if (!selectedProductId || !selectedPresetId || selectedCardIds.size === 0) {
      toast.error("请完成所有步骤");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/automation/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          presetId: selectedPresetId,
          cardIds: Array.from(selectedCardIds),
          inputConfig: {
            ...(contentDelimiter.trim() && {
              contentDelimiter: contentDelimiter.trim(),
            }),
          },
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`任务创建成功，共 ${data.itemCount} 条`);
        router.push(`/admin/automation/${data.id}`);
      } else {
        toast.error(data.error || "创建失败");
      }
    } catch {
      toast.error("创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  return (
    <div className="space-y-6">
      {/* Step 1: Select Product */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          步骤 1：选择商品
        </Label>
        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="选择一个商品" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            {products.length === 0 ? (
              <SelectItem value="_empty" disabled>
                暂无可用商品
              </SelectItem>
            ) : (
              products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Step 2: Select Preset */}
      {selectedProductId && (
        <div className="space-y-3">
          <Label className="text-base font-medium">
            步骤 2：选择任务类型
          </Label>
          {loading && presets.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              加载中...
            </div>
          ) : presets.length === 0 ? (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>该商品暂无可用的自动化预设</AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedPresetId === preset.id
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                  }`}
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    setStep(2);
                  }}
                >
                  <div className="font-medium">{preset.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {preset.presetType === "STATUS_TEST" && "测试账号登录状态是否正常"}
                    {preset.presetType === "CHANGE_PASSWORD" && "批量修改账号密码并回写"}
                    {preset.presetType === "CHANGE_REGION" && "批量修改账号地区并可选回写"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Card delimiter (optional) + Select Cards */}
      {selectedPresetId && step >= 2 && (
        <div className="space-y-3">
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
              若卡密格式为「账号----密码----其他」，可填写 <code className="rounded bg-muted px-1">----</code> 以正确提取账号和密码
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">
              步骤 3：选择要操作的卡密
            </Label>
            {cards.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleToggleAll}>
                {selectedCardIds.size === cards.length ? "取消全选" : "全选"}
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              加载卡密中...
            </div>
          ) : cards.length === 0 ? (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>该商品暂无未售卡密</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                共 {cards.length} 条未售卡密，已选 {selectedCardIds.size} 条
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
                {cards.map((card) => (
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
            </>
          )}
        </div>
      )}

      {/* Submit */}
      {selectedCardIds.size > 0 && (
        <div className="flex items-center gap-4 pt-4 border-t">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                创建任务
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
          <span className="text-sm text-muted-foreground">
            将对 {selectedCardIds.size} 条卡密执行「{selectedPreset?.name}」
          </span>
        </div>
      )}
    </div>
  );
}
