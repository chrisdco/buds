import { shouldNotify } from "@/services/notifications";

describe("shouldNotify", () => {
  it("fires the first time an id is seen and records it", () => {
    const result = shouldNotify({}, "arrive:bob", 1_000);
    expect(result.fire).toBe(true);
    expect(result.fired["arrive:bob"]).toBe(1_000);
  });

  it("suppresses a repeat within the dedup window", () => {
    const after = shouldNotify({ "arrive:bob": 1_000 }, "arrive:bob", 5_000, 30_000);
    expect(after.fire).toBe(false);
    expect(after.fired["arrive:bob"]).toBe(1_000); // unchanged
  });

  it("fires again once the window has elapsed", () => {
    const after = shouldNotify({ "arrive:bob": 1_000 }, "arrive:bob", 40_000, 30_000);
    expect(after.fire).toBe(true);
    expect(after.fired["arrive:bob"]).toBe(40_000);
  });

  it("treats distinct ids independently", () => {
    const after = shouldNotify({ "arrive:bob": 1_000 }, "sep:self", 2_000);
    expect(after.fire).toBe(true);
    expect(after.fired["sep:self"]).toBe(2_000);
    expect(after.fired["arrive:bob"]).toBe(1_000);
  });
});
