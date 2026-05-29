// Items materialized per source for the popover list + dismiss-all, and the
// basis for the route's "unread = candidates − dismissed" tally. Set one past
// the badge's "99+" threshold (99 + 1) so the summed unread count is exact
// through 99 and correctly reads ">99" beyond, without materializing unbounded
// pending rows.
//
// Lives in its own module (not index.ts) so source files can import it without
// a runtime circular dependency — index.ts imports the sources to register them.
export const SOURCE_ITEM_TAKE = 100
