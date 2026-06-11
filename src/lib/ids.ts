// Room codes use a confusable-free alphabet (no I, L, O, 0, 1) — must match
// generate_room_code() in supabase/migrations/0002_rpcs.sql.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

const CODE_CHARS = new Set(CODE_ALPHABET.split(""));

/** Uppercases and strips anything that can't be part of a room code. */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .split("")
    .filter((c) => CODE_CHARS.has(c))
    .join("")
    .slice(0, CODE_LENGTH);
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Extracts a room code from scanned/shared invite data: either a
 * "buds://join/CODE" (or https .../join/CODE) link, or input that is exactly
 * a bare code. Deliberately strict — arbitrary text/URLs must NOT melt down
 * into something code-shaped.
 */
export function parseInviteCode(data: string): string | null {
  const linkMatch = data.match(/join\/([A-Za-z0-9]{4,8})/);
  if (linkMatch) {
    const code = normalizeCode(linkMatch[1]);
    return code.length === CODE_LENGTH ? code : null;
  }
  const trimmed = data.trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(trimmed)) return null;
  return normalizeCode(trimmed).length === CODE_LENGTH ? trimmed : null;
}
