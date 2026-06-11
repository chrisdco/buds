import { createAlertEngine } from "@/events/alertEngine";
import type { AlertCondition } from "@/modes/types";

function cond(partial: Partial<AlertCondition>): AlertCondition {
  return {
    id: "test",
    active: true,
    sustainMs: 0,
    severity: "info",
    title: "Test",
    ...partial,
  };
}

describe("createAlertEngine", () => {
  it("primes silently: already-active conditions never fire for late joiners", () => {
    const engine = createAlertEngine();
    expect(engine.evaluate([cond({ active: true })], 0)).toHaveLength(0);
    // still considered fired afterwards
    expect(engine.evaluate([cond({ active: true })], 1000)).toHaveLength(0);
  });

  it("fires an instant (sustain 0) condition once", () => {
    const engine = createAlertEngine();
    engine.evaluate([cond({ active: false })], 0); // priming pass
    const fired = engine.evaluate([cond({ active: true })], 1000);
    expect(fired).toHaveLength(1);
    expect(engine.evaluate([cond({ active: true })], 2000)).toHaveLength(0);
  });

  it("waits out the sustain window before firing", () => {
    const engine = createAlertEngine();
    engine.evaluate([], 0); // prime
    const c = cond({ sustainMs: 30_000 });
    expect(engine.evaluate([c], 1_000)).toHaveLength(0); // starts counting
    expect(engine.evaluate([c], 15_000)).toHaveLength(0);
    expect(engine.evaluate([c], 31_500)).toHaveLength(1);
  });

  it("re-arms when the condition clears", () => {
    const engine = createAlertEngine();
    engine.evaluate([], 0);
    expect(engine.evaluate([cond({ active: true })], 1)).toHaveLength(1);
    engine.evaluate([cond({ active: false })], 2); // clears -> re-arm
    expect(engine.evaluate([cond({ active: true })], 3)).toHaveLength(1);
  });

  it("a sustain window restarts if the condition flaps", () => {
    const engine = createAlertEngine();
    engine.evaluate([], 0);
    const c = cond({ sustainMs: 10_000 });
    engine.evaluate([c], 1_000);
    engine.evaluate([cond({ ...c, active: false })], 5_000); // flap
    engine.evaluate([c], 6_000); // counting restarts here
    expect(engine.evaluate([c], 12_000)).toHaveLength(0); // only 6s sustained
    expect(engine.evaluate([c], 16_500)).toHaveLength(1);
  });
});
