import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { unauthorized, badRequest } from "@/lib/api-response";
import {
  AUTOMATION_CATEGORY,
  DEFAULT_APPLE_PRESETS,
} from "@/lib/automation/constants";

/**
 * GET /api/automation/presets?productId=xxx
 * Get available automation presets for a product (Apple category only).
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");

  if (!productId) {
    return badRequest("productId is required");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  });

  if (!product) {
    return badRequest("Product not found");
  }

  let presets = await prisma.productAutomationPreset.findMany({
    where: {
      productId,
      category: AUTOMATION_CATEGORY.APPLE,
      isEnabled: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (presets.length === 0) {
    const created = await prisma.$transaction(
      DEFAULT_APPLE_PRESETS.map((preset) =>
        prisma.productAutomationPreset.create({
          data: {
            productId,
            category: AUTOMATION_CATEGORY.APPLE,
            presetKey: preset.presetKey,
            name: preset.name,
            presetType: preset.presetType,
            adapterKey: preset.adapterKey,
            configJson: preset.configJson as Record<string, unknown>,
            isEnabled: true,
          },
        })
      )
    );
    presets = created;
  }

  return NextResponse.json({
    category: AUTOMATION_CATEGORY.APPLE,
    presets: presets.map((p) => ({
      id: p.id,
      presetKey: p.presetKey,
      name: p.name,
      presetType: p.presetType,
      configJson: p.configJson,
    })),
  });
}

export const runtime = "nodejs";
