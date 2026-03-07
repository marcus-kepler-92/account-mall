"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, ChevronDown, ChevronRight, AlertCircle, Info, AlertTriangle } from "lucide-react";

type LogEntry = {
  id: string;
  taskId: string;
  itemId: string | null;
  level: string;
  step: string;
  message: string;
  data: Record<string, unknown> | null;
  createdAt: string;
};

type Props = {
  taskId: string;
  /** 仅展示该条卡密（该项）的日志；不传则展示整任务日志 */
  itemId?: string | null;
};

type ViewMode = "result" | "all";
type LevelFilter = "ALL" | "INFO" | "WARN" | "ERROR";

const levelConfig: Record<string, { icon: typeof Info; color: string }> = {
  INFO: { icon: Info, color: "text-muted-foreground" },
  WARN: { icon: AlertTriangle, color: "text-warning" },
  ERROR: { icon: AlertCircle, color: "text-destructive" },
};

const stepLabels: Record<string, string> = {
  TASK_START: "任务开始",
  TASK_COMPLETE: "任务完成",
  ITEM_START: "项目开始",
  ITEM_COMPLETE: "项目完成",
  ITEM_FAILED: "项目失败",
  LOGIN_START: "开始登录",
  LOGIN_SUCCESS: "登录成功",
  LOGIN_FAILED: "登录失败",
  CHANGE_PASSWORD_START: "开始改密",
  CHANGE_PASSWORD_SUCCESS: "改密成功",
  CHANGE_PASSWORD_FAILED: "改密失败",
  CHANGE_REGION_START: "开始改地区",
  CHANGE_REGION_SUCCESS: "改地区成功",
  CHANGE_REGION_FAILED: "改地区失败",
  STATUS_CHECK_START: "开始状态检测",
  STATUS_CHECK_SUCCESS: "状态检测成功",
  STATUS_CHECK_FAILED: "状态检测失败",
};

export function TaskLogsTimeline({ taskId, itemId }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("result");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("view", viewMode);
      params.set("limit", "500");
      if (itemId) {
        params.set("itemId", itemId);
      }
      if (levelFilter !== "ALL") {
        params.set("level", levelFilter);
      }
      const res = await fetch(`/api/automation/tasks/${taskId}/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  }, [taskId, itemId, viewMode, levelFilter]);

  useEffect(() => {
    setLoading(true);
    fetchLogs().finally(() => setLoading(false));
  }, [fetchLogs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <RefreshCw className="size-4 animate-spin mr-2" />
        加载日志中...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="result">仅结果</SelectItem>
              <SelectItem value="all">全部步骤</SelectItem>
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as LevelFilter)}>
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部等级</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="WARN">WARN</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            共 {logs.length} 条
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          暂无执行日志
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />
          
          <div className="space-y-0">
            {logs.map((log) => {
              const config = levelConfig[log.level] || levelConfig.INFO;
              const hasData = log.data && Object.keys(log.data).length > 0;
              const isExpanded = expandedLogs.has(log.id);
              const stepLabel = stepLabels[log.step] || log.step;

              return (
                <div key={log.id} className="relative pl-6 pb-3">
                  <div
                    className={`absolute left-0 top-1 size-4 rounded-full bg-background flex items-center justify-center border ${
                      log.level === "ERROR"
                        ? "border-destructive"
                        : log.level === "WARN"
                        ? "border-warning"
                        : "border-border"
                    }`}
                  >
                    <div
                      className={`size-2 rounded-full ${
                        log.level === "ERROR"
                          ? "bg-destructive"
                          : log.level === "WARN"
                          ? "bg-warning"
                          : "bg-muted-foreground"
                      }`}
                    />
                  </div>

                  <Collapsible open={isExpanded} onOpenChange={() => hasData && toggleExpand(log.id)}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs font-normal">
                            {stepLabel}
                          </Badge>
                          <span className={`text-sm ${config.color}`}>
                            {log.message}
                          </span>
                          {log.itemId && (
                            <span className="text-xs text-muted-foreground">
                              #{log.itemId.slice(-6)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatTime(log.createdAt)}
                        </div>
                      </div>

                      {hasData && (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            {isExpanded ? (
                              <ChevronDown className="size-3" />
                            ) : (
                              <ChevronRight className="size-3" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </div>

                    {hasData && (
                      <CollapsibleContent>
                        <pre className="mt-2 p-2 rounded bg-muted text-xs overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
