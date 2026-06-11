import { normalizeCode, parseInviteCode } from "@/lib/ids";

describe("normalizeCode", () => {
  it("uppercases and strips invalid characters", () => {
    expect(normalizeCode(" ab c-2:34 ")).toBe("ABC234");
  });

  it("strips confusables (0, 1, I, L, O)", () => {
    expect(normalizeCode("A0B1I LO2")).toBe("AB2");
  });

  it("caps at code length", () => {
    expect(normalizeCode("ABCDEFGH")).toBe("ABCDEF");
  });
});

describe("parseInviteCode", () => {
  it("parses a buds:// deep link", () => {
    expect(parseInviteCode("buds://join/ABC234")).toBe("ABC234");
  });

  it("parses an https link with a join path", () => {
    expect(parseInviteCode("https://example.com/join/abc234")).toBe("ABC234");
  });

  it("accepts a bare code", () => {
    expect(parseInviteCode("abc234")).toBe("ABC234");
  });

  it("rejects garbage", () => {
    expect(parseInviteCode("https://evil.example.com")).toBeNull();
    expect(parseInviteCode("AB")).toBeNull();
  });
});
