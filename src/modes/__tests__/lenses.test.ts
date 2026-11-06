import {
  assignTiers,
  effectiveLens,
  etaRangeLabel,
  legendCounts,
  lensesFor,
  suggestStragglers,
  type PersonForTier,
} from "@/modes/lenses";

const people = (n: number): PersonForTier[] =>
  Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, etaS: (i + 1) * 60, arrived: false }));

describe("lenses per mode", () => {
  it("offers mode-specific lenses with the default first", () => {
    expect(lensesFor("converge")[0]).toBe("everyone");
    expect(lensesFor("multitrack")[0]).toBe("me");
    expect(lensesFor("solo")).toEqual([]);
    // Own way: different destinations, so "latest" means nothing.
    expect(lensesFor("multitrack")).not.toContain("stragglers");
  });

  it("falls back to the default when the chosen lens isn't offered", () => {
    expect(effectiveLens("formation", "arrivals")).toBe("everyone");
    expect(effectiveLens("converge", "stragglers")).toBe("stragglers");
    expect(effectiveLens("multitrack", null)).toBe("me");
  });
});

describe("assignTiers", () => {
  it("Everyone, small group: you primary, everyone else secondary", () => {
    const t = assignTiers({ people: people(4), myUserId: "u0", lens: "everyone", focusIds: [] });
    expect(t).toEqual({ u0: "primary", u1: "secondary", u2: "secondary", u3: "secondary" });
  });

  it("Everyone, 6 people: latest 4 secondary, the rest context", () => {
    const t = assignTiers({ people: people(6), myUserId: "u0", lens: "everyone", focusIds: [] });
    expect(t.u0).toBe("primary");
    expect(["u5", "u4", "u3", "u2"].map((u) => t[u])).toEqual(Array(4).fill("secondary"));
    expect(t.u1).toBe("context");
  });

  it("Everyone, 10 people: latest 2 secondary, the rest hidden", () => {
    const t = assignTiers({ people: people(10), myUserId: "u0", lens: "everyone", focusIds: [] });
    expect(t.u9).toBe("secondary");
    expect(t.u8).toBe("secondary");
    expect(t.u7).toBe("hidden");
    expect(legendCounts(t, 10)).toEqual({ shown: 3, total: 10 });
  });

  it("Me: only your line", () => {
    const t = assignTiers({ people: people(3), myUserId: "u1", lens: "me", focusIds: [] });
    expect(t).toEqual({ u0: "hidden", u1: "primary", u2: "hidden" });
  });

  it("Stragglers: the two latest primary, next two secondary", () => {
    const t = assignTiers({ people: people(6), myUserId: "u0", lens: "stragglers", focusIds: [] });
    expect([t.u5, t.u4, t.u3, t.u2, t.u1, t.u0]).toEqual([
      "primary",
      "primary",
      "secondary",
      "secondary",
      "context",
      "context",
    ]);
  });

  it("Arrivals: no lines", () => {
    const t = assignTiers({ people: people(3), myUserId: "u0", lens: "arrivals", focusIds: [] });
    expect(Object.values(t)).toEqual(["hidden", "hidden", "hidden"]);
  });

  it("Focus overrides the lens; everyone else (you too) is hidden", () => {
    const t = assignTiers({ people: people(5), myUserId: "u0", lens: "me", focusIds: ["u3"] });
    expect(t).toEqual({ u0: "hidden", u1: "hidden", u2: "hidden", u3: "primary", u4: "hidden" });
  });

  it("Stragglers grows its primary set with the group: 1, 2, then 3", () => {
    const primaries = (n: number) =>
      Object.values(assignTiers({ people: people(n), myUserId: "u0", lens: "stragglers", focusIds: [] })).filter(
        (t) => t === "primary",
      ).length;
    expect([primaries(3), primaries(4), primaries(5), primaries(7), primaries(8), primaries(10)]).toEqual([
      1, 1, 2, 2, 3, 3,
    ]);
  });

  it("Focus past the primary cap demotes to secondary", () => {
    const t = assignTiers({
      people: people(6),
      myUserId: "u0",
      lens: "everyone",
      focusIds: ["u1", "u2", "u3", "u4"],
    });
    expect([t.u1, t.u2, t.u3, t.u4]).toEqual(["primary", "primary", "primary", "secondary"]);
  });

  it("arrived people never get a line and focus on them is ignored", () => {
    const ps = people(3);
    ps[2].arrived = true;
    const t = assignTiers({ people: ps, myUserId: "u0", lens: "everyone", focusIds: ["u2"] });
    expect(t).toEqual({ u0: "primary", u1: "secondary", u2: "hidden" });
  });

  it("unknown ETAs sort after known ones", () => {
    const ps: PersonForTier[] = [
      { userId: "a", etaS: null, arrived: false },
      { userId: "b", etaS: 100, arrived: false },
      { userId: "c", etaS: 900, arrived: false },
    ];
    const t = assignTiers({ people: ps, myUserId: null, lens: "stragglers", focusIds: [] });
    expect(t).toEqual({ c: "primary", b: "secondary", a: "secondary" });
  });
});

describe("big-group helpers", () => {
  it("suggests Stragglers from 8 travelers, unless it's on or focus is", () => {
    expect(suggestStragglers(7, "everyone", false)).toBe(false);
    expect(suggestStragglers(8, "everyone", false)).toBe(true);
    expect(suggestStragglers(8, "stragglers", false)).toBe(false);
    expect(suggestStragglers(9, "everyone", true)).toBe(false);
  });

  it("labels the ETA spread in minutes", () => {
    expect(etaRangeLabel([720, null, 1860, 900])).toBe("12–31 min");
    expect(etaRangeLabel([600, 610])).toBe("10 min");
    expect(etaRangeLabel([600, undefined])).toBeNull();
  });
});
