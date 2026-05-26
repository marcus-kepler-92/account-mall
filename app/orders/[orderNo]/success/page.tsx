import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyOrderSuccessToken } from "@/lib/order-success-token";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { SiteHeader } from "@/app/components/site-header";
import { resolveCardFields } from "@/lib/card-format";
import {
  getCrossSellSetting,
  getCrossSellRecommendations,
  getCsExpiryMs,
  getCsRemainingMs,
  resolveCrossSellDiscountsForProducts,
  signCsTokenForOrder,
} from "@/lib/cross-sell";
import { appendCsParam } from "@/lib/cs-params";
import { ManualSuccessView } from "./manual-success-view";
import { SuccessShell } from "./success-shell";
import { NormalCardsSection } from "./normal-cards-section";
import { AutoFetchCardsSection } from "./auto-fetch-cards-section";
import { getSiteSettings } from "@/lib/site-settings";
import { formatEtaText } from "@/lib/business-hours";

type PageProps = {
  params: Promise<{ orderNo: string }>;
  searchParams: Promise<{ token?: string; cs?: string }>;
};

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  params,
  searchParams,
}: PageProps) {
  const { orderNo } = await params;
  const { token, cs: incomingCs } = await searchParams;

  if (!token || !verifyOrderSuccessToken(orderNo, token)) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader cs={incomingCs} />
        <main className="flex-1 px-4 py-12">
          <div className="mx-auto max-w-md">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="size-5" />
                  <CardTitle>验证失效</CardTitle>
                </div>
                <CardDescription>
                  链接已过期或无效，请使用订单号和查询密码重新查询
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link
                    href={`/orders/lookup?orderNo=${encodeURIComponent(orderNo)}`}
                  >
                    去订单查询
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const order = await prisma.order.findFirst({
    where: { orderNo },
    include: {
      product: {
        select: {
          name: true,
          productType: true,
          allowAccountSwitch: true,
          accountSwitchLimit: true,
          cardTemplates: {
            orderBy: { sortOrder: "asc" },
            select: { template: true },
          },
        },
      },
      cards: {
        where: { status: { in: ["SOLD", "RESERVED"] } },
        select: { content: true },
      },
    },
  });

  if (!order) notFound();
  // MANUAL products are fulfilled out-of-band by admin. After payment the order
  // sits in AWAITING_FULFILLMENT (and later PROCESSING) — render a dedicated
  // "等待发货" view with timeline + ETA instead of the cards-centric layout,
  // and short-circuit before the COMPLETED guard below (status won't match yet).
  // If the order has already been fulfilled by the time the buyer lands here
  // we still want the success view (it renders the completed timeline state).
  if (order.product?.productType === "MANUAL") {
    const settings = await getSiteSettings();
    const etaText = formatEtaText(new Date(), {
      start: settings.businessHoursStart,
      end: settings.businessHoursEnd,
      weekdays: settings.businessHoursWeekdays,
      timezone: settings.businessHoursTimezone,
    });
    if (
      order.status === "AWAITING_FULFILLMENT" ||
      order.status === "PROCESSING" ||
      order.status === "COMPLETED"
    ) {
      return (
        <ManualSuccessView
          orderNo={order.orderNo}
          status={order.status}
          productName={
            order.productNameSnapshot ?? order.product?.name ?? "商品"
          }
          variantName={order.variantNameSnapshot}
          amount={Number(order.amount)}
          etaText={etaText}
          cs={incomingCs}
        />
      );
    }
    // PENDING / CLOSED falls through to the generic "订单未完成" card below.
  }
  if (order.status !== "COMPLETED") {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader cs={incomingCs} />
        <main className="flex-1 px-4 py-12">
          <div className="mx-auto max-w-md">
            <Card>
              <CardHeader>
                <CardTitle>订单未完成</CardTitle>
                <CardDescription>
                  当前订单状态为「
                  {order.status === "PENDING" ? "待支付" : "已关闭"}
                  」，无法查看卡密
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/orders/lookup">返回订单查询</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const cards = order.cards.map((c) => c.content);
  const cardTemplates = order.product?.cardTemplates ?? [];
  const resolvedCards = order.cards.map((c) =>
    resolveCardFields(c.content, cardTemplates),
  );
  const productName =
    order.productNameSnapshot ?? order.product?.name ?? "商品";
  const isAutoFetch = order.product?.productType === "AUTO_FETCH";
  const expiresAt = order.expiresAt ? order.expiresAt.toISOString() : null;
  const notExpired = !order.expiresAt || order.expiresAt > new Date();
  const switchLimit = order.product?.accountSwitchLimit ?? 1;
  const remainingSwitches = Math.max(0, switchLimit - order.switchAccountCount);
  const canSwitch =
    isAutoFetch &&
    (order.product?.allowAccountSwitch ?? true) &&
    remainingSwitches > 0 &&
    notExpired;

  // Cross-sell section data — single cs token bound to this order, applied to
  // every recommendation link and consumed across the storefront for the TTL
  // window starting from paidAt. TTL is anchored to paidAt (not "now") so the
  // session doesn't reset when the user refreshes this page.
  const crossSellSetting = await getCrossSellSetting();
  const crossSellRecommendations = crossSellSetting.enabled
    ? await getCrossSellRecommendations(order.productId)
    : [];

  const ttlMs = crossSellSetting.ttlMinutes * 60_000;
  const csExpiresAt = getCsExpiryMs(order.paidAt, crossSellSetting.ttlMinutes);
  const csInitialRemainingMs = getCsRemainingMs(csExpiresAt);

  // Sign a fresh cs token anchored to paidAt + TTL. Returns null past the
  // window so the recommendation links degrade to plain (no-discount) URLs.
  const csToken = crossSellSetting.enabled
    ? signCsTokenForOrder(order.id, order.paidAt, crossSellSetting.ttlMinutes)
    : null;

  // Per-item discount via the same resolver the product detail page uses.
  // Without this, the recommendation card would advertise a discounted price
  // (just by multiplying setting.discountPercent) while the detail page —
  // which honors CrossSellUsage / eligibility / TTL — would show the original.
  // The visual lie ("¥37.80 here, ¥42 there") is exactly the bug we're fixing.
  const recDiscountMap = csToken
    ? await resolveCrossSellDiscountsForProducts(
        csToken,
        crossSellRecommendations.map((p) => p.id),
      )
    : new Map<string, number>();

  // Filter out recommendations where the resolver says no discount applies —
  // already consumed via CrossSellUsage, ineligible after the session sweep,
  // or out of TTL. Showing such items at original price next to discounted
  // ones in the same "支付成功礼" block creates a visual lie ("title says 9折
  // but this row isn't?") and lures users into clicks that land on full price.
  // If everything is filtered out, the whole section won't render anyway
  // (caller checks crossSellItems.length > 0).
  const crossSellItems = crossSellSetting.enabled
    ? crossSellRecommendations
        .map((product) => {
          const itemDiscount = recDiscountMap.get(product.id) ?? 0;
          if (itemDiscount <= 0) return null;
          const baseParams = new URLSearchParams({ email: order.email });
          const baseHref = `/products/${product.slug}?${baseParams}`;
          return {
            product,
            href: appendCsParam(baseHref, csToken),
            discountPercent: itemDiscount,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    : [];

  return (
    <SuccessShell
      orderId={order.id}
      orderNo={orderNo}
      productName={productName}
      amount={Number(order.amount)}
      cardsCount={cards.length}
      cs={csToken ?? incomingCs}
      crossSell={
        crossSellItems.length > 0
          ? {
              recommendations: crossSellItems,
              discountPercent: crossSellSetting.discountPercent,
              ttlMs,
              expiresAt: csExpiresAt,
              initialRemainingMs: csInitialRemainingMs,
            }
          : null
      }
    >
      {isAutoFetch ? (
        <AutoFetchCardsSection
          orderNo={orderNo}
          expiresAt={expiresAt}
          initialCards={cards}
          token={token!}
          remainingSwitches={canSwitch ? remainingSwitches : 0}
        />
      ) : (
        <NormalCardsSection cards={resolvedCards} />
      )}
    </SuccessShell>
  );
}
