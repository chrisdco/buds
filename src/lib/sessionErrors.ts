/**
 * Plain-language copy for a failed session start. The raw error stays in
 * the log: users see what to do, not "TypeError: Network request failed".
 */
export function sessionErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/anonymous sign-ins are disabled/i.test(msg)) {
    return "Sign-in is switched off on the server right now.";
  }
  if (/rate limit|too many/i.test(msg)) {
    return "Too many attempts. Wait a minute, then retry.";
  }
  return "Can't reach Buds. Check your connection and retry.";
}
