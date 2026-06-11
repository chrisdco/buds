// Clock-skew handling: sender clocks are corrected against the DB clock once
// per snapshot fetch, so `t` in outgoing ticks is comparable across devices.
// Staleness math on the *receiving* side always uses local receive time.

let skewMs = 0;

export function setServerNowMs(serverNowMs: number): void {
  skewMs = serverNowMs - Date.now();
}

export function serverNowMs(): number {
  return Date.now() + skewMs;
}

export function formatAgo(deltaMs: number): string {
  if (deltaMs < 10_000) return "now";
  if (deltaMs < 60_000) return `${Math.round(deltaMs / 1000)}s ago`;
  if (deltaMs < 3_600_000) return `${Math.round(deltaMs / 60_000)}m ago`;
  return `${Math.round(deltaMs / 3_600_000)}h ago`;
}
