// Generic local alert engine: strategies report raw CONDITIONS (pure data),
// this engine owns the stateful parts — sustain windows, dedupe, re-arming —
// so the same rules apply to every mode and they're testable in isolation.
//
// Priming: the first evaluation marks already-active conditions as fired
// WITHOUT emitting, so a late joiner isn't blasted with stale alerts
// ("X arrived" from an hour ago).

import type { AlertCondition } from "@/modes/types";

export interface LocalAlert {
  id: string;
  severity: "info" | "warn";
  title: string;
  body?: string;
}

export interface AlertEngine {
  evaluate(conditions: AlertCondition[], nowMs: number): LocalAlert[];
  reset(): void;
}

export function createAlertEngine(): AlertEngine {
  let firstActiveAt = new Map<string, number>();
  let fired = new Set<string>();
  let primed = false;

  return {
    evaluate(conditions, nowMs) {
      const alerts: LocalAlert[] = [];

      if (!primed) {
        primed = true;
        for (const c of conditions) {
          if (c.active) fired.add(c.id);
        }
        return alerts;
      }

      for (const c of conditions) {
        if (!c.active) {
          // condition cleared: re-arm
          firstActiveAt.delete(c.id);
          fired.delete(c.id);
          continue;
        }
        if (fired.has(c.id)) continue;

        const since = firstActiveAt.get(c.id);
        if (since == null) {
          firstActiveAt.set(c.id, nowMs);
          if (c.sustainMs > 0) continue;
        }
        if (nowMs - (firstActiveAt.get(c.id) ?? nowMs) >= c.sustainMs) {
          fired.add(c.id);
          alerts.push({ id: c.id, severity: c.severity, title: c.title, body: c.body });
        }
      }
      return alerts;
    },

    reset() {
      firstActiveAt = new Map();
      fired = new Set();
      primed = false;
    },
  };
}
