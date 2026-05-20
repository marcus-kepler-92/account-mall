import { z } from "zod"

export const leadPatchSchema = z.object({
    status: z
        .enum(["PENDING_CONTACT", "NEW", "CONTACTED", "RESOLVED", "DROPPED"])
        .optional(),
    notes: z.string().max(2000, "备注过长").optional(),
})

export type LeadPatchInput = z.infer<typeof leadPatchSchema>
