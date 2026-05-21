-- Allow multiple AgentLead rows per AgentSession.
--
-- Reason: a sessionId is a 90-day client-side ULID, so one customer can
-- end up triggering escalate_to_human many times during a single session
-- (e.g. asks for refund on Mon, asks about login on Tue). The previous
-- @@unique(sessionId) caused the second escalate to upsert + overwrite
-- the first lead's reason / status / conversation snapshot, silently
-- losing the earlier consultation from ops view.
--
-- Effect:
--   - drop the UNIQUE index on AgentLead.sessionId
--   - add a non-unique compound index (sessionId, createdAt) for the
--     admin "list leads of this session in time order" query path
--
-- Backward-compat: existing rows are unaffected; future escalates will
-- INSERT new rows instead of UPSERTing the same row.

DROP INDEX "AgentLead_sessionId_key";

CREATE INDEX "AgentLead_sessionId_createdAt_idx" ON "AgentLead"("sessionId", "createdAt");
