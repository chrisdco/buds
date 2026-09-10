import { useUiStore } from "@/stores/uiStore";

describe("requestConfirm", () => {
  beforeEach(() => {
    useUiStore.getState().reset();
  });

  it("resolves true on confirm and clears state", async () => {
    const pending = useUiStore.getState().requestConfirm({
      title: "Leave?",
      confirmLabel: "Leave",
      destructive: true,
    });
    expect(useUiStore.getState().confirm?.title).toBe("Leave?");
    useUiStore.getState().resolveConfirm(true);
    await expect(pending).resolves.toBe(true);
    expect(useUiStore.getState().confirm).toBeNull();
  });

  it("resolves false on dismiss", async () => {
    const pending = useUiStore.getState().requestConfirm({
      title: "Leave?",
      confirmLabel: "Leave",
      destructive: true,
    });
    useUiStore.getState().resolveConfirm(false);
    await expect(pending).resolves.toBe(false);
  });

  it("resolves a replaced request false instead of hanging it", async () => {
    const first = useUiStore.getState().requestConfirm({
      title: "First?",
      confirmLabel: "Yes",
      destructive: false,
    });
    const second = useUiStore.getState().requestConfirm({
      title: "Second?",
      confirmLabel: "Yes",
      destructive: false,
    });
    await expect(first).resolves.toBe(false);
    useUiStore.getState().resolveConfirm(true);
    await expect(second).resolves.toBe(true);
  });

  it("reset() resolves pending requests false", async () => {
    const pending = useUiStore.getState().requestConfirm({
      title: "Leave?",
      confirmLabel: "Leave",
      destructive: true,
    });
    useUiStore.getState().reset();
    await expect(pending).resolves.toBe(false);
    expect(useUiStore.getState().confirm).toBeNull();
  });
});
