-- Product SEO overrides: SERP title + meta description, both optional.
ALTER TABLE "Product" ADD COLUMN "seoTitle" VARCHAR(60),
ADD COLUMN "seoDescription" VARCHAR(160);
