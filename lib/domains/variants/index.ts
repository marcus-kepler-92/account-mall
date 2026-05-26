// lib/domains/variants/index.ts
export {
  listVariants,
  createVariantForProduct,
  updateVariantById,
  deleteVariantById,
  assertProductHasActiveVariant,
} from "./service"
export { findVariantById, decrementVariantStock, incrementVariantStock } from "./repository"
export type { VariantRow } from "./types"
export {
  VariantNotFoundError,
  VariantHasOrdersError,
  NotManualProductError,
} from "./types"
export { variantCreateSchema, variantUpdateSchema } from "./validators"
export type { VariantCreateInput, VariantUpdateInput } from "./validators"
