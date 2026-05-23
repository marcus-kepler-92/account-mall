import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { isStorefrontTurnstileEnforced } from "@/lib/turnstile-policy";
import { Zap, Clock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/app/components/site-header";
import { ProductOrderSection } from "./product-order-section";
import { SoldOutOverlay } from "@/app/components/sold-out-overlay";
import { RestockReminderForm } from "./restock-reminder-form";
import { ProductBottomBar } from "../../components/product-bottom-bar";
import { descriptionToPlainText } from "@/lib/description";
import { MarkdownViewClient } from "@/app/components/markdown-view-client";
import { RiskWarningDialog } from "./risk-warning-dialog";
import { resolveCrossSellDiscount } from "@/lib/cross-sell";
import { getSiteSettings } from "@/lib/site-settings";
import { formatBusinessHoursHint } from "@/lib/business-hours";
import type { ProductVariantOption } from "@/app/components/product-variant-selector";

const PRODUCT_CACHE_TTL_SECONDS = 300;
const STOCK_CACHE_TTL_SECONDS = 30;

const getCachedProductBySlug = unstable_cache(
  async (slug: string) =>
    prisma.product.findUnique({
      where: { slug },
      include: { tags: { select: { id: true, name: true, slug: true } } },
    }),
  ["product-detail-by-slug"],
  { revalidate: PRODUCT_CACHE_TTL_SECONDS, tags: ["products"] },
);

const getCachedProductMetaBySlug = unstable_cache(
  async (slug: string) =>
    prisma.product.findUnique({
      where: { slug },
      select: {
        name: true,
        description: true,
        price: true,
        status: true,
        image: true,
        id: true,
        slug: true,
      },
    }),
  ["product-meta-by-slug"],
  { revalidate: PRODUCT_CACHE_TTL_SECONDS, tags: ["products"] },
);

const getCachedStockCount = unstable_cache(
  async (productId: string) =>
    prisma.card.count({ where: { productId, status: "UNSOLD" } }),
  ["product-stock"],
  { revalidate: STOCK_CACHE_TTL_SECONDS, tags: ["cards"] },
);

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ promoCode?: string; email?: string; cs?: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCachedProductMetaBySlug(slug);
  if (!product || product.status !== "ACTIVE") return { title: "商品" };

  const desc = product.description
    ? descriptionToPlainText(product.description, 160)
    : `${product.name} - ¥${Number(product.price).toFixed(2)}`;
  const productUrl = `${config.siteUrl}/products/${product.slug}`;
  const ogImages = product.image ? [{ url: product.image }] : undefined;
  return {
    title: product.name,
    description: desc,
    alternates: { canonical: productUrl },
    openGraph: {
      title: product.name,
      description: desc,
      url: productUrl,
      siteName: config.siteName,
      type: "website",
      ...(ogImages && { images: ogImages }),
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: desc,
      ...(ogImages && { images: ogImages }),
    },
  };
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const resolvedParams = await searchParams;

  const product = await getCachedProductBySlug(slug);

  if (!product || product.status !== "ACTIVE") {
    notFound();
  }

  const prefilledEmail = resolvedParams.email?.trim() || null
  // Resolve cross-sell discount via the single source-of-truth function.
  // Returns null on missing/invalid/expired/used/ineligible — we then render
  // original price. Token itself is forwarded to the order form so the
  // backend re-verifies before applying the discount.
  const csToken: string | null = resolvedParams.cs ?? null
  const crossSellDiscountPercent = csToken
    ? await resolveCrossSellDiscount(csToken, product.id)
    : null

  const productWithImage = product as typeof product & { image: string | null };

  const isAutoFetch = product.productType === "AUTO_FETCH";
  const isManual = product.productType === "MANUAL";

  // MANUAL: stock is the sum of all active variants' stockQuantity; cards table
  // is unused. NORMAL: stock is the count of UNSOLD cards. AUTO_FETCH: not
  // stock-bound (treated as infinite for display purposes).
  const variants: ProductVariantOption[] = isManual
    ? (
        await prisma.productVariant.findMany({
          where: { productId: product.id, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            price: true,
            stockQuantity: true,
            isActive: true,
          },
        })
      ).map((v) => ({
        id: v.id,
        name: v.name,
        price: Number(v.price).toFixed(2),
        stockQuantity: v.stockQuantity,
        isActive: v.isActive,
      }))
    : [];

  const manualStock = isManual
    ? variants.reduce((sum, v) => sum + Math.max(v.stockQuantity, 0), 0)
    : 0;
  const stockCount = isManual ? manualStock : await getCachedStockCount(product.id);

  const isFree = isAutoFetch && Number(product.price) === 0;
  const isSoldOut = !isAutoFetch && stockCount === 0;
  const lowStockThreshold =
    Number(process.env.NEXT_PUBLIC_LOW_STOCK_THRESHOLD) || 5;
  const isLowStock =
    !isAutoFetch &&
    !isSoldOut &&
    stockCount > 0 &&
    stockCount <= lowStockThreshold;

  // Business-hours hint shown beneath the MANUAL order card so buyers know
  // when human fulfillment is available. Computed from SiteSettings (DB → env).
  let businessHoursHint: string | undefined;
  if (isManual) {
    const settings = await getSiteSettings();
    businessHoursHint = formatBusinessHoursHint({
      start: settings.businessHoursStart,
      end: settings.businessHoursEnd,
      weekdays: settings.businessHoursWeekdays,
      timezone: settings.businessHoursTimezone,
    });
  }
  const priceNumber = Number(product.price);
  const requireTurnstile =
    Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) &&
    isStorefrontTurnstileEnforced();

  const productUrl = `${config.siteUrl}/products/${product.slug}`;
  const descriptionPlain = product.description
    ? descriptionToPlainText(product.description, 160)
    : `${product.name} - ¥${priceNumber.toFixed(2)}`;

  const imageRaw = productWithImage.image;
  const imageAbsolute =
    imageRaw &&
    (imageRaw.startsWith("http://") || imageRaw.startsWith("https://"))
      ? imageRaw
      : imageRaw && imageRaw.startsWith("/")
        ? config.siteUrl + imageRaw
        : imageRaw || undefined;

  const priceValidUntil = new Date();
  priceValidUntil.setDate(
    priceValidUntil.getDate() + config.schemaPriceValidUntilDays,
  );
  const priceValidUntilStr = priceValidUntil.toISOString().slice(0, 10);

  const offers: Record<string, unknown> = {
    "@type": "Offer",
    price: priceNumber,
    priceCurrency: "CNY",
    availability: isSoldOut
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock",
    url: productUrl,
    priceValidUntil: priceValidUntilStr,
    itemCondition: "https://schema.org/NewCondition",
  };

  offers.shippingDetails = {
    "@type": "OfferShippingDetails",
    shippingDestination: {
      "@type": "Country",
      addressCountry: config.schemaShippingCountry,
    },
    shippingRate: {
      "@type": "MonetaryAmount",
      value: config.schemaShippingValue,
      currency: "CNY",
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: config.schemaDeliveryHandlingDays,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: config.schemaDeliveryTransitDays,
        unitCode: "DAY",
      },
    },
  };

  const merchantReturnPolicy: Record<string, unknown> = {
    "@type": "MerchantReturnPolicy",
    applicableCountry: config.schemaShippingCountry,
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: config.schemaReturnDays,
    returnFees: `https://schema.org/${config.schemaReturnFees}`,
  };
  if (config.schemaReturnMethod.trim()) {
    merchantReturnPolicy.returnMethod = `https://schema.org/${config.schemaReturnMethod.trim()}`;
  }
  offers.hasMerchantReturnPolicy = merchantReturnPolicy;

  const productJsonLd = {
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.name,
    description: descriptionPlain,
    url: productUrl,
    sku: product.id,
    ...(imageAbsolute && { image: imageAbsolute }),
    brand: { "@type": "Brand", name: config.schemaBrandName },
    offers,
  };

  const breadcrumbItems: { name: string; item: string }[] = [
    { name: "首页", item: config.siteUrl },
  ];
  if (product.tags.length > 0) {
    const primaryTag = product.tags[0];
    breadcrumbItems.push({
      name: primaryTag.name,
      item: `${config.siteUrl}/?tag=${encodeURIComponent(primaryTag.slug)}`,
    });
  }
  breadcrumbItems.push({ name: product.name, item: productUrl });

  const breadcrumbJsonLd = {
    "@type": "BreadcrumbList",
    "@id": `${productUrl}#breadcrumb`,
    itemListElement: breadcrumbItems.map((b, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: b.name,
      item: b.item,
    })),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [productJsonLd, breadcrumbJsonLd],
  };

  const jsonLdSafe = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe }}
      />
      <SiteHeader cs={csToken} />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-4 2xl:max-w-7xl lg:pb-10 lg:pt-8">
        <div
          className={cn(
            "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10",
            !productWithImage.image &&
              !product.description &&
              "space-y-6 lg:block",
          )}
        >
          {/* Left: media + description (mobile: 顶部媒体 + 详情) */}
          <div className="flex min-w-0 flex-col space-y-4 lg:space-y-6">
            <ProductMediaSection
              image={productWithImage.image}
              name={product.name}
              isSoldOut={isSoldOut}
            />
            {product.description && (
              <section aria-label="商品详情">
                <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
                  <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                    商品详情
                  </h2>
                  <MarkdownViewClient content={product.description} />
                </div>
              </section>
            )}
          </div>

          {/* Right: info + meta + order + restock（PC 侧栏卡片，移动端纵向） */}
          <div className="mt-4 flex min-w-0 flex-col space-y-4 lg:mt-0 lg:space-y-4 lg:sticky lg:top-24 lg:self-start">
            <ProductInfoSection
              name={product.name}
              tags={product.tags}
              price={priceNumber}
              stockCount={stockCount}
              isSoldOut={isSoldOut}
              isFree={isFree}
              isAutoFetch={isAutoFetch}
              isLowStock={isLowStock}
              discountPercent={crossSellDiscountPercent}
            />

            <ProductMetaNoticeSection />

            {product.riskWarningEnabled && product.riskWarningContent && (
              <RiskWarningDialog
                productId={product.id}
                title={product.riskWarningTitle}
                content={product.riskWarningContent}
                countdown={product.riskWarningCountdown}
                confirmText={product.riskWarningConfirmText}
              />
            )}

            <section id="order-section">
              <ProductOrderSection
                productId={product.id}
                productName={product.name}
                maxQuantity={isManual ? 1 : isAutoFetch ? 1 : product.maxQuantity}
                price={priceNumber}
                inStock={!isSoldOut}
                formId="product-order-form"
                productType={product.productType}
                validityHours={product.validityHours}
                couponEnabled={product.couponEnabled}
                requireTurnstile={requireTurnstile}
                prefilledEmail={prefilledEmail ?? undefined}
                cs={crossSellDiscountPercent != null ? csToken : null}
                crossSellDiscountPercent={crossSellDiscountPercent}
                variants={isManual ? variants : undefined}
                businessHoursHint={businessHoursHint}
              />
            </section>

            {isSoldOut && (
              <Suspense
                fallback={<Skeleton className="h-32 w-full rounded-lg hidden lg:block" />}
              >
                <ProductRestockSection
                  productId={product.id}
                  productName={product.name}
                />
              </Suspense>
            )}
          </div>
        </div>
      </main>

      <ProductBottomBar
        price={priceNumber}
        inStock={!isSoldOut}
        orderSectionId="order-section"
        formId="product-order-form"
        isFree={isFree}
        requireTurnstile={requireTurnstile}
      />
    </div>
  );
}

type ProductMediaSectionProps = {
  image: string | null;
  name: string;
  isSoldOut: boolean;
};

function ProductMediaSection({
  image,
  name,
  isSoldOut,
}: ProductMediaSectionProps) {
  if (!image) return null;

  return (
    <section aria-label="商品图片">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted lg:aspect-square">
        <Image
          src={image}
          alt={name}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className={cn("object-fill", isSoldOut && "grayscale")}
          priority
        />
        {isSoldOut && <SoldOutOverlay badgePosition="right-3 top-3" />}
      </div>
    </section>
  );
}

type ProductInfoSectionProps = {
  name: string;
  tags: { id: string; name: string; slug: string }[];
  price: number;
  stockCount: number;
  isSoldOut: boolean;
  isFree?: boolean;
  isAutoFetch?: boolean;
  isLowStock?: boolean;
  // Cross-sell discount applied to this product for the current cs session.
  // When set, the price block renders strike-through original + red discounted
  // — keeps the displayed price consistent with what the order form will
  // actually charge.
  discountPercent?: number | null;
};

function ProductInfoSection({
  name,
  tags,
  price,
  stockCount,
  isSoldOut,
  isFree,
  isAutoFetch,
  isLowStock,
  discountPercent,
}: ProductInfoSectionProps) {
  const hasDiscount =
    !isSoldOut &&
    !isFree &&
    typeof discountPercent === "number" &&
    discountPercent > 0 &&
    discountPercent < 100 &&
    price > 0;
  const discountedPrice = hasDiscount ? price * (1 - discountPercent! / 100) : price;
  return (
    <section
      aria-labelledby="product-info-heading"
      className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="space-y-3">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-[11px] font-normal opacity-80"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
        <h1
          id="product-info-heading"
          className="text-xl font-bold leading-snug tracking-tight lg:text-2xl"
        >
          {name}
        </h1>
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            {isFree ? (
              <>
                <span className="text-2xl font-bold tabular-nums text-primary lg:text-3xl">
                  免费
                </span>
              </>
            ) : (
              <>
                {hasDiscount ? (
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-muted-foreground line-through tabular-nums">
                      ¥{price.toFixed(2)}
                    </span>
                    <span className="text-2xl font-bold tabular-nums text-destructive lg:text-3xl">
                      ¥{discountedPrice.toFixed(2)}
                    </span>
                  </span>
                ) : (
                  <span
                    className={cn(
                      "text-2xl font-bold tabular-nums lg:text-3xl",
                      isSoldOut && "text-muted-foreground line-through",
                    )}
                  >
                    ¥{price.toFixed(2)}
                  </span>
                )}
                {isAutoFetch ? (
                  <Badge variant="secondary" className="text-xs font-normal">
                    有货
                  </Badge>
                ) : isSoldOut ? (
                  <Badge variant="outline" className="text-xs font-normal">
                    已售罄
                  </Badge>
                ) : isLowStock ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-500 dark:text-orange-400 animate-pulse">
                    仅剩 {stockCount} 件，手慢无！
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    库存 {stockCount} 件
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductMetaNoticeSection() {
  return (
    <section className="rounded-xl border bg-muted/40 p-3 sm:p-3.5">
      <ul className="space-y-2">
        <li className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          自动发货，付款后秒到
        </li>
        <li className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          7×24 小时自助下单，随时可买
        </li>
        <li className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          安全支付，信息加密传输
        </li>
      </ul>
    </section>
  );
}

type ProductRestockSectionProps = {
  productId: string;
  productName: string;
};

function ProductRestockSection({
  productId,
  productName,
}: ProductRestockSectionProps) {
  return (
    <section id="restock-section" aria-label="催货" className="hidden lg:block">
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <RestockReminderForm productId={productId} productName={productName} />
      </div>
    </section>
  );
}
