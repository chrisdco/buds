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
