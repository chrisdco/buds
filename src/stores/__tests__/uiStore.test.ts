import { useUiStore } from "@/stores/uiStore";

beforeEach(() => {
  useUiStore.getState().reset();
});

describe("focus set", () => {
  it("starts empty", () => {
    expect(useUiStore.getState().focusUserIds).toEqual([]);
  });

  it("toggles members in and out, preserving order", () => {
    const store = useUiStore.getState();
    store.toggleFocusUserId("u-a");
    store.toggleFocusUserId("u-b");
    expect(useUiStore.getState().focusUserIds).toEqual(["u-a", "u-b"]);
    useUiStore.getState().toggleFocusUserId("u-a");
    expect(useUiStore.getState().focusUserIds).toEqual(["u-b"]);
  });

  it("replaces the set wholesale and clears on reset", () => {
    useUiStore.getState().setFocusUserIds(["u-a", "u-b"]);
    expect(useUiStore.getState().focusUserIds).toEqual(["u-a", "u-b"]);
    useUiStore.getState().reset();
    expect(useUiStore.getState().focusUserIds).toEqual([]);
  });
});
