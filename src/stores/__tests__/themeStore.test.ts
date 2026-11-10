import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

import { useThemeStore } from "@/stores/themeStore";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("Appearance preference", () => {
  const setColorScheme = jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
  beforeEach(() => {
    setColorScheme.mockClear();
    useThemeStore.setState({ pref: "system", ready: false });
  });

  it("defaults to the phone's setting and hands native control back", async () => {
    await useThemeStore.getState().hydrate();
    expect(useThemeStore.getState()).toMatchObject({ pref: "system", ready: true });
    expect(setColorScheme).toHaveBeenCalledWith("unspecified");
  });

  it("restores a pinned scheme and tells the OS", async () => {
    await AsyncStorage.setItem("buds.theme", "light");
    await useThemeStore.getState().hydrate();
    expect(useThemeStore.getState().pref).toBe("light");
    expect(setColorScheme).toHaveBeenCalledWith("light");
  });

  it("ignores garbage in storage", async () => {
    await AsyncStorage.setItem("buds.theme", "sepia");
    await useThemeStore.getState().hydrate();
    expect(useThemeStore.getState().pref).toBe("system");
  });

  it("persists a switch", async () => {
    useThemeStore.getState().setPref("dark");
    expect(setColorScheme).toHaveBeenLastCalledWith("dark");
    await expect(AsyncStorage.getItem("buds.theme")).resolves.toBe("dark");
  });
});
