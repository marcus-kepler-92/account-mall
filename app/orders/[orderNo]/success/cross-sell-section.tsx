"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, Package, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/app/components/product-card";

type CrossSellRecommendation = {
  product: ProductCardData;
  href: string;
  discountPercent: number;
};

type CrossSellSectionProps = {
  recommendations: CrossSellRecommendation[];
  discountPercent: number;
  ttlMs: number;
  orderId: string;
};

// lastTickTime is only updated when the interval fires, never inside getSnapshot,
// so the snapshot is stable between ticks and doesn't cause infinite re-renders.
let lastTickTime = Date.now();

function subscribe(callback: () => void) {
  const id = setInterval(() => {
    lastTickTime = Date.now();
    callback();
  }, 1000);
  return () => clearInterval(id);
}

function useCountdownMs(expiresAt: number): number {
  return useSyncExternalStore(
    subscribe,
    () => Math.max(0, expiresAt - lastTickTime),
    () => Math.max(0, expiresAt - lastTickTime),
  );
}

const AVATAR_COLORS = [
  "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
  "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
] as const;

function getGlyph(product: ProductCardData): string {
  const source = product.tags[0]?.name ?? product.name;
  return source.slice(0, 2).toUpperCase();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function CrossSellSection({
  recommendations,
  discountPercent,
  ttlMs,
  orderId,
}: CrossSellSectionProps) {
  const hasDiscount = discountPercent > 0;
  const [expiresAt] = useState(() => {
    // sessionStorage is not available during SSR; client remounts read the persisted value
    if (typeof window === "undefined") return Date.now() + ttlMs;
    const key = `cs-exp-${orderId}`;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      const t = Number(stored);
      if (t > Date.now()) return t;
    }
    const t = Date.now() + ttlMs;
    sessionStorage.setItem(key, String(t));
    return t;
  });

  // After SSR hydration the initializer didn't run on the client, so persist here
  useEffect(() => {
    const key = `cs-exp-${orderId}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, String(expiresAt));
    }
  }, [orderId, expiresAt]);
  const remainingMs = useCountdownMs(expiresAt);
  const isExpired = hasDiscount && remainingMs <= 0;
  const isUrgent = hasDiscount && remainingMs <= 3 * 60_000 && !isExpired; // < 3 min
  const isCritical = hasDiscount && remainingMs <= 60_000 && !isExpired; // < 1 min
  const pulseStyle = isCritical
    ? { animationDuration: "0.55s" }
    : isUrgent
      ? { animationDuration: "1.4s" }
      : undefined;
  const progressPct = Math.max(0, (remainingMs / ttlMs) * 100);
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const countdownStr = `${pad(minutes)}:${pad(seconds)}`;
  const discountLabel = `${100 - discountPercent} 折`;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card overflow-hidden transition-opacity duration-700",
        isExpired && "opacity-60",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "border-b",
          isExpired
            ? "bg-muted border-border"
            : isCritical
              ? "bg-destructive/5 border-destructive/40 dark:bg-destructive/10"
              : isUrgent
                ? "bg-orange-50/70 border-orange-300/60 dark:bg-orange-950/20 dark:border-orange-800/60"
                : "bg-amber-50/80 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <Sparkles
            className={cn(
              "size-4 shrink-0",
              isExpired
                ? "text-muted-foreground"
                : isCritical
                  ? "text-destructive"
                  : isUrgent
                    ? "text-orange-500"
                    : "text-amber-500",
            )}
          />

          <span
            className={cn(
              "text-sm font-medium flex-1 min-w-[140px] leading-tight",
              isExpired
                ? "text-muted-foreground"
                : isCritical
                  ? "text-destructive"
                  : isUrgent
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-amber-700 dark:text-amber-400",
            )}
          >
            {isExpired ? (
              "限时折扣已过期 · 仍可按原价购买"
            ) : isCritical ? (
              "🔥 最后机会，即将失效！"
            ) : isUrgent ? (
              "⏳ 快过期了，赶紧下单"
            ) : hasDiscount ? (
              <>
                支付成功礼 · 同账号专享{" "}
                <span className="inline-flex items-center font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-600 text-amber-50 align-baseline">
                  {discountLabel}
                </span>
              </>
            ) : (
              "为你推荐"
            )}
          </span>

          {hasDiscount && !isExpired && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-1 rounded-full border shrink-0 tabular-nums bg-card",
                isCritical
                  ? "text-destructive border-destructive/40 animate-pulse"
                  : isUrgent
                    ? "text-orange-500 dark:text-orange-400 border-orange-300 dark:border-orange-700 animate-pulse"
                    : "text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
              )}
              style={pulseStyle}
            >
              <Clock className="size-3 opacity-70" />
              {/* Countdown reads sessionStorage on the client, which can hold a deadline from
                  an earlier visit. The SSR value naturally differs — suppress the warning so
                  React quietly accepts the client value on hydration. */}
              <span suppressHydrationWarning>{countdownStr}</span>
            </span>
          )}
        </div>

        {/* Depleting progress bar */}
        {hasDiscount && !isExpired && (
          <div className="h-1 w-full bg-black/5 dark:bg-white/10">
            <div
              className={cn(
                "h-full transition-[width] duration-1000 ease-linear",
                isCritical
                  ? "bg-destructive animate-pulse"
                  : isUrgent
                    ? "bg-orange-400 animate-pulse"
                    : "bg-amber-400",
              )}
              style={{ width: `${progressPct}%`, ...pulseStyle }}
            />
          </div>
        )}
      </div>

      {/* Product rows */}
      <div className="divide-y divide-border">
        {recommendations.map((rec, i) => {
          const { product, href, discountPercent: pct } = rec;
          const hasItemDiscount = !isExpired && pct > 0 && product.price > 0;
          const discountedPrice = product.price * (1 - pct / 100);
          const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];

          return (
            <div
              key={product.id}
              className="grid grid-cols-[40px_1fr_auto] gap-3 items-center px-4 py-3 transition-colors hover:bg-muted/40"
            >
              {/* Thumbnail — image if available, letter avatar fallback */}
              <div
                className={cn(
                  "size-10 rounded-lg border overflow-hidden shrink-0 flex items-center justify-center font-mono text-[11px] font-semibold",
                  !product.image && avatarColor,
                )}
              >
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={40}
                    height={40}
                    className="object-cover size-full"
                  />
                ) : product.tags[0] ? (
                  getGlyph(product)
                ) : (
                  <Package className="size-4" />
                )}
              </div>

              {/* Name + tags */}
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight truncate">
                  {product.name}
                </p>
                {product.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {product.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="text-[10px] font-normal px-1.5 py-px"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Price + CTA */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right tabular-nums">
                  {hasItemDiscount ? (
                    <>
                      <p className="text-[15px] font-semibold text-destructive leading-tight">
                        <span className="text-[11px] align-middle mr-px font-medium">
                          ¥
                        </span>
                        {discountedPrice.toFixed(discountedPrice < 100 ? 2 : 0)}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground line-through mt-0.5">
                        ¥{product.price.toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold leading-tight">
                      <span className="text-[11px] align-middle mr-px font-medium">
                        ¥
                      </span>
                      {product.price.toFixed(2)}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={isExpired ? "outline" : "default"}
                  className="h-8 px-2.5 text-xs whitespace-nowrap"
                  asChild
                >
                  <Link href={href}>{isExpired ? "详情" : "购买"}</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
