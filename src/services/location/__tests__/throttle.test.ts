import type { Fix } from "@/services/location/jitterFilter";
import { createSendThrottle } from "@/services/location/throttle";

const BASE = { lat: 48.2, lng: 16.37, accuracy: 5 };

function fix(partial: Partial<Fix>): Fix {
  return { ...BASE, atMs: 0, ...partial };
}

// ~0.0005° lat ≈ 55m — comfortably above the 8m movement gate
const MOVED = 0.0005;

describe("createSendThrottle", () => {
  it("always sends the first fix", () => {
    const throttle = createSendThrottle();
    expect(throttle(fix({ speed: 10 })).send).toBe(true);
  });

  it("suppresses fixes inside the driving interval", () => {
    const throttle = createSendThrottle();
    throttle(fix({ speed: 10, atMs: 0 }));
    expect(throttle(fix({ speed: 10, lat: BASE.lat + MOVED, atMs: 1000 })).send).toBe(false);
  });

  it("sends after the driving interval when moved", () => {
    const throttle = createSendThrottle();
    throttle(fix({ speed: 10, atMs: 0 }));
    expect(throttle(fix({ speed: 10, lat: BASE.lat + MOVED, atMs: 2600 })).send).toBe(true);
  });

  it("does not send when stationary inside the stationary interval", () => {
    const throttle = createSendThrottle();
    throttle(fix({ speed: 0, atMs: 0 }));
    expect(throttle(fix({ speed: 0, atMs: 5000 })).send).toBe(false);
  });

  it("emits a heartbeat even without movement", () => {
    const throttle = createSendThrottle();
    throttle(fix({ speed: 0, atMs: 0 }));
    const verdict = throttle(fix({ speed: 0, atMs: 31_000 }));
    expect(verdict.send).toBe(true);
    expect(verdict.moving).toBe(false);
  });

  it("doubles the interval in the background", () => {
    const throttle = createSendThrottle({ isBackground: () => true });
    throttle(fix({ speed: 10, atMs: 0 }));
    // 2.6s would send in the foreground; background interval is 5s
    expect(throttle(fix({ speed: 10, lat: BASE.lat + MOVED, atMs: 2600 })).send).toBe(false);
    expect(throttle(fix({ speed: 10, lat: BASE.lat + 2 * MOVED, atMs: 5200 })).send).toBe(true);
  });

  it("respects the remote throttle floor", () => {
    const throttle = createSendThrottle({ floorMs: () => 10_000 });
    throttle(fix({ speed: 10, atMs: 0 }));
    expect(throttle(fix({ speed: 10, lat: BASE.lat + MOVED, atMs: 2600 })).send).toBe(false);
    expect(throttle(fix({ speed: 10, lat: BASE.lat + 2 * MOVED, atMs: 10_100 })).send).toBe(true);
  });

  it("estimates speed from movement when the GPS gives none", () => {
    const throttle = createSendThrottle();
    throttle(fix({ atMs: 0 }));
    // ~55m in 5s ≈ 11 m/s -> driving tier, moved -> sends
    const verdict = throttle(fix({ lat: BASE.lat + MOVED, atMs: 5000 }));
    expect(verdict.send).toBe(true);
    expect(verdict.moving).toBe(true);
  });
});
