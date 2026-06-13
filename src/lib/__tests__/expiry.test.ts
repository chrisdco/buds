import { EXPIRY_WARN_MS, expiryInfo, extendedExpiryIso } from "@/lib/expiry";

const NOW = Date.parse("2026-06-12T12:00:00Z");

describe("expiryInfo", () => {
  it("returns null when the room has no expiry", () => {
    expect(expiryInfo(null, NOW)).toBeNull();
  });

  it("returns null for an unparseable timestamp", () => {
    expect(expiryInfo("not-a-date", NOW)).toBeNull();
  });

  it("does not warn when expiry is far away", () => {
    const future = new Date(NOW + 2 * 3600_000).toISOString();
    const info = expiryInfo(future, NOW)!;
    expect(info.expired).toBe(false);
    expect(info.warning).toBe(false);
    expect(info.label).toBe("Expires in 2 h");
  });

  it("warns inside the 10-minute window with a mm:ss countdown", () => {
    const soon = new Date(NOW + 9 * 60_000 + 58_000).toISOString();
    const info = expiryInfo(soon, NOW)!;
    expect(info.warning).toBe(true);
    expect(info.expired).toBe(false);
    expect(info.label).toBe("Expires in 9:58");
  });

  it("flags an expired room", () => {
    const past = new Date(NOW - 1000).toISOString();
    const info = expiryInfo(past, NOW)!;
    expect(info.expired).toBe(true);
    expect(info.warning).toBe(true);
    expect(info.label).toBe("Room expired");
  });

  it("treats the warn boundary inclusively", () => {
    const atBoundary = new Date(NOW + EXPIRY_WARN_MS).toISOString();
    expect(expiryInfo(atBoundary, NOW)!.warning).toBe(true);
  });
});

describe("extendedExpiryIso", () => {
  it("adds to the current expiry when it is still in the future", () => {
    const current = new Date(NOW + 30 * 60_000).toISOString();
    const result = extendedExpiryIso(current, 60 * 60_000, NOW);
    expect(Date.parse(result)).toBe(NOW + 90 * 60_000);
  });

  it("adds from now when the current expiry is already past", () => {
    const past = new Date(NOW - 60_000).toISOString();
    const result = extendedExpiryIso(past, 60 * 60_000, NOW);
    expect(Date.parse(result)).toBe(NOW + 60 * 60_000);
  });

  it("adds from now when there was no expiry", () => {
    const result = extendedExpiryIso(null, 4 * 3600_000, NOW);
    expect(Date.parse(result)).toBe(NOW + 4 * 3600_000);
  });
});
