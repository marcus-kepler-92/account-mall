// lib/domains/cards/index.ts

// Service functions — admin card management
export {
  getCardsByProduct,
  exportCards,
  bulkImportCards,
  patchCardStatus,
  deleteCard,
  batchCardAction,
} from "./service"

// Cross-domain repository functions — called by orders domain with tx
export {
  reserveCardsForOrder,
  releaseReservedCards,
  deleteAutoFetchCards,
  markCardsSold,
} from "./repository"

// Validators
export { bulkImportCardsSchema, patchCardStatusSchema, batchCardActionSchema } from "./validators"
export type { BulkImportCardsInput, PatchCardStatusInput, BatchCardActionInput } from "./validators"

// Types
export type { Card, CardStatus, CardRow, CardStats, BulkImportResult, BatchActionResult } from "./types"

// Domain errors
export { CardNotFoundError, CardStatusTransitionError, AutoFetchProductError } from "./types"
