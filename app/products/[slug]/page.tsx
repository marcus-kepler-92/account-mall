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
import { verifyCrossSellToken } from "@/lib/cross-sell-token";

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
  searchParams: Promise<{ promoCode?: string; email?: string; csToken?: string }>;
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
  let crossSellToken: string | null = null
  let crossSellDiscountPercent: number | null = null
  if (resolvedParams.csToken) {
    const csVerify = verifyCrossSellToken(resolvedParams.csToken)
    if (csVerify.valid && csVerify.payload?.targetProductId === product.id) {
      crossSellToken = resolvedParams.csToken
      crossSellDiscountPercent = csVerify.payload.discountPercent
    }
  }

  const productWithImage = product as typeof product & { image: string | null };

  const stockCount = await getCachedStockCount(product.id);

  const isAutoFetch = product.productType === "AUTO_FETCH";
  const isFree = isAutoFetch && Number(product.price) === 0;
  const isSoldOut = !isAutoFetch && stockCount === 0;
  const lowStockThreshold =
    Number(process.env.NEXT_PUBLIC_LOW_STOCK_THRESHOLD) || 5;
  const isLowStock =
    !isAutoFetch &&
    !isSoldOut &&
    stockCount > 0 &&
    stockCount <= lowStockThreshold;
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
      <SiteHeader />

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
                maxQuantity={isAutoFetch ? 1 : product.maxQuantity}
                price={priceNumber}
                inStock={!isSoldOut}
                formId="product-order-form"
                productType={product.productType}
                validityHours={product.validityHours}
                couponEnabled={product.couponEnabled}
                requireTurnstile={requireTurnstile}
                prefilledEmail={prefilledEmail ?? undefined}
                crossSellToken={crossSellToken}
                crossSellDiscountPercent={crossSellDiscountPercent}
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
}: ProductInfoSectionProps) {
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
                <span
                  className={cn(
                    "text-2xl font-bold tabular-nums lg:text-3xl",
                    isSoldOut && "text-muted-foreground line-through",
                  )}
                >
                  ¥{price.toFixed(2)}
                </span>
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
