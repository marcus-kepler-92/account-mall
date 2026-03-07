/**
 * 自动化服务器日志：输出到 stdout/stderr，供运维/排障与监控。
 * 仅 API 层（run、batch-run）调用；禁止写入 account、password、cardContent 等敏感信息。
 */

const PREFIX = "[automation]";

export type ServerLogLevel = "info" | "warn" | "error";

export type ServerLogMeta = {
  taskId?: string;
  itemId?: string;
  phase?: string;
  error?: string;
  errorCode?: string;
  [key: string]: unknown;
};

export function serverLog(
  level: ServerLogLevel,
  message: string,
  meta?: ServerLogMeta
): void {
  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  const line = `${PREFIX} ${message}${payload}`;
  switch (level) {
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
    default:
      console.log(line);
  }
}
