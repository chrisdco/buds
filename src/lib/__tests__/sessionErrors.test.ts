import { sessionErrorMessage } from "@/lib/sessionErrors";

describe("sessionErrorMessage", () => {
  it("hides raw network errors behind connection copy", () => {
    expect(sessionErrorMessage(new TypeError("Network request failed"))).toBe(
      "Can't reach Buds. Check your connection and retry.",
    );
  });

  it("names a server that has anonymous sign-in switched off", () => {
    expect(sessionErrorMessage(new Error("Anonymous sign-ins are disabled"))).toMatch(/switched off/);
  });

  it("asks to wait on rate limits", () => {
    expect(sessionErrorMessage(new Error("Request rate limit reached"))).toMatch(/Wait a minute/);
  });

  it("falls back for non-Error values", () => {
    expect(sessionErrorMessage(null)).toMatch(/Can't reach Buds/);
  });
});
