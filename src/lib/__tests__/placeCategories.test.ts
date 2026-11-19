import { byDistance, categoryFor, PLACE_CATEGORIES, recentsWithDistance } from "@/lib/placeCategories";

describe("categoryFor", () => {
  it("matches a chip's query regardless of case and spaces", () => {
    expect(categoryFor("Petrol station")?.id).toBe("petrol");
    expect(categoryFor("  atm ")?.id).toBe("atm");
    expect(categoryFor("petrol")).toBeNull();
    expect(categoryFor("")).toBeNull();
  });

  it("only has queries long enough to search", () => {
    for (const c of PLACE_CATEGORIES) expect(c.query.trim().length).toBeGreaterThanOrEqual(3);
  });
});

describe("byDistance", () => {
  it("puts the nearest first and unknown distances last, stably", () => {
    const rows = [
      { id: "a", distanceM: 900 },
      { id: "b", distanceM: null },
      { id: "c", distanceM: 120 },
      { id: "d", distanceM: null },
    ];
    expect(byDistance(rows).map((r) => r.id)).toEqual(["c", "a", "b", "d"]);
  });
});

describe("recentsWithDistance", () => {
  const recent = { name: "Cafe", address: "", lat: 19.1, lng: 72.9, atMs: 0 };

  it("measures from where you are", () => {
    const [r] = recentsWithDistance([recent], { lat: 19.1, lng: 72.91 });
    expect(r.distanceM).toBeGreaterThan(1000);
    expect(r.distanceM).toBeLessThan(1100);
  });

  it("leaves distance unknown without a fix", () => {
    expect(recentsWithDistance([recent], null)[0].distanceM).toBeNull();
  });
});
