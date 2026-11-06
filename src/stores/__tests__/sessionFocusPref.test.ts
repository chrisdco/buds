import AsyncStorage from "@react-native-async-storage/async-storage";

import { useSessionStore } from "@/stores/sessionStore";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@/lib/supabaseClient", () => ({ supabase: {}, supabaseConfigured: false }));

describe("Your route in Focus preference", () => {
  it("defaults on and persists when switched", async () => {
    expect(useSessionStore.getState().focusShowsMe).toBe(true);
    useSessionStore.getState().setFocusShowsMe(false);
    expect(useSessionStore.getState().focusShowsMe).toBe(false);
    await expect(AsyncStorage.getItem("buds.focusShowsMe")).resolves.toBe("0");
    useSessionStore.getState().setFocusShowsMe(true);
    await expect(AsyncStorage.getItem("buds.focusShowsMe")).resolves.toBe("1");
  });
});
