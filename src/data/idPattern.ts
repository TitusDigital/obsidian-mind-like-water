/**
 * Single source of truth for MLW task ID shapes.
 *
 * The plugin is mid-migration from 6-char alphanumeric IDs (v0.x) to RFC 4122
 * UUIDs. Until every user has run migration 004 ("uuid-ids"), either format may
 * appear in a user's vault. These regexes accept both. New IDs minted by
 * `DataStore.generateId()` are always UUIDs.
 */

/** `[a-z0-9]{6}` — legacy 6-char hex IDs from the v0.x plugin. */
export const LEGACY_ID_PATTERN = "[a-z0-9]{6}";

/** RFC 4122 UUID (lowercase hex, with hyphens). */
export const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Either legacy or UUID. Use this when matching IDs in vault markdown. */
export const MLW_ID_PATTERN = `(?:${LEGACY_ID_PATTERN}|${UUID_PATTERN})`;

/** Match a `<!-- mlw:<id> -->` comment anywhere on a line, capturing the ID. */
export const MLW_COMMENT_RE = new RegExp(`<!-- mlw:(${MLW_ID_PATTERN}) -->`);

/** Same as `MLW_COMMENT_RE` but with a leading `\s*` — for stripping from display. */
export const MLW_COMMENT_STRIP_RE = new RegExp(`\\s*<!-- mlw:${MLW_ID_PATTERN} -->`);

/** Fresh global-flag regex for vault-wide scans (avoids lastIndex bleed). */
export function mlwCommentGlobalRe(): RegExp {
	return new RegExp(`<!-- mlw:(${MLW_ID_PATTERN}) -->`, "g");
}

const LEGACY_ID_STANDALONE_RE = new RegExp(`^${LEGACY_ID_PATTERN}$`);
const UUID_STANDALONE_RE = new RegExp(`^${UUID_PATTERN}$`);

/** True if `id` looks like a legacy 6-char hex ID. */
export function isLegacyId(id: string): boolean {
	return LEGACY_ID_STANDALONE_RE.test(id);
}

/** True if `id` looks like a UUID. */
export function isUuid(id: string): boolean {
	return UUID_STANDALONE_RE.test(id);
}
