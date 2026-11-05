import { getAppConfig, parseAppConfig, setAppConfigForTest } from "@/lib/appConfig";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@/lib/supabaseClient", () => ({ supabase: {}, supabaseConfigured: false }));

describe("app config", () => {
  it("defaults when nothing is set", () => {
    expect(parseAppConfig(undefined)).toEqual({ routing: { proxy: true } });
  });

  it("reads valid values", () => {
    expect(parseAppConfig({ routing: { proxy: false } }).routing.proxy).toBe(false);
  });

  it("falls back per field on bad values and ignores unknown keys", () => {
    expect(parseAppConfig({ routing: { proxy: "nope" }, extra: 1 })).toEqual({ routing: { proxy: true } });
    expect(parseAppConfig({ routing: 42 })).toEqual({ routing: { proxy: true } });
  });

  it("exposes the current config synchronously", () => {
    setAppConfigForTest({ routing: { proxy: false } });
    expect(getAppConfig().routing.proxy).toBe(false);
    setAppConfigForTest({});
  });
});
