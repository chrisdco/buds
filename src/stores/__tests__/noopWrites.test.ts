import { useMembersStore } from "@/stores/membersStore";
import { useRouteStore } from "@/stores/routeStore";
import type { MemberLive } from "@/types/contracts";

// Room-wide re-renders hang off these two stores; writes that change
// nothing must leave state identical.
describe("no-op store writes", () => {
  it("presence sync keeps state when nobody's presence changed", () => {
    const m = { userId: "a", online: true, appState: "active" } as unknown as MemberLive;
    const b = { userId: "b", online: false, appState: undefined } as unknown as MemberLive;
    useMembersStore.setState({ members: { a: m, b } });
    const before = useMembersStore.getState().members;
    useMembersStore.getState().syncPresence({ a: [{ appState: "active" }] } as never);
    expect(useMembersStore.getState().members).toBe(before);

    useMembersStore.getState().syncPresence({ a: [{ appState: "active" }], b: [{}] } as never);
    const after = useMembersStore.getState().members;
    expect(after).not.toBe(before);
    expect(after.a).toBe(m);
    expect(after.b.online).toBe(true);
  });

  it("setTiers ignores an identical map", () => {
    useRouteStore.getState().setTiers({ a: "primary" });
    const before = useRouteStore.getState().tiers;
    useRouteStore.getState().setTiers({ a: "primary" });
    expect(useRouteStore.getState().tiers).toBe(before);
    useRouteStore.getState().setTiers({ a: "hidden" });
    expect(useRouteStore.getState().tiers).not.toBe(before);
  });
});
