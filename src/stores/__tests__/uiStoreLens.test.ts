import { PAN_HOLD_MS, useUiStore } from "@/stores/uiStore";

describe("lens pick and the pan hold", () => {
  beforeEach(() => useUiStore.getState().reset());
  afterEach(() => jest.restoreAllMocks());

  it("re-frames the camera when you haven't panned recently", () => {
    const ui = useUiStore.getState();
    ui.setFocusUserIds(["a"]);
    ui.setCameraMode("manual");
    ui.pickLens("stragglers");
    const s = useUiStore.getState();
    expect(s.lens).toBe("stragglers");
    expect(s.focusUserIds).toEqual([]);
    expect(s.cameraMode).toBe("auto");
    expect(s.recenterHint).toBe(false);
  });

  it("leaves the camera alone and shows Re-center within the hold window", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    useUiStore.getState().markUserPan();
    now.mockReturnValue(1_000_000 + PAN_HOLD_MS - 1);
    useUiStore.getState().pickLens("me");
    const s = useUiStore.getState();
    expect(s.lens).toBe("me");
    expect(s.cameraMode).toBe("manual");
    expect(s.recenterHint).toBe(true);
    // Back to auto (the Re-center pill / FAB) clears the pill.
    s.setCameraMode("auto");
    expect(useUiStore.getState().recenterHint).toBe(false);
  });

  it("after the hold window a lens pick moves the camera again", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(5_000_000);
    useUiStore.getState().markUserPan();
    now.mockReturnValue(5_000_000 + PAN_HOLD_MS + 1);
    useUiStore.getState().pickLens("everyone");
    expect(useUiStore.getState().cameraMode).toBe("auto");
  });
});
