// Startup smoke and the main flow: the real app directory (every route
// module, the root layout's init, the tab bar, Home, create, the room
// screen) rendered under Jest.
// Catches module-scope crashes, broken imports between screens, and
// startup code that throws, in seconds and without an emulator. Native
// modules are Jest mocks, so a missing native module still needs a build.
import { fireEvent, screen } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";

// Backend: a signed-in anonymous session; every query resolves empty.
jest.mock("@/lib/supabaseClient", () => {
  const empty = { data: null, error: null };
  const session = { user: { id: "u1" }, access_token: "t" };
  // Chainable stand-in for the query builder and realtime channels: any
  // property is callable, and awaiting the chain yields an empty result.
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, key) =>
      key === "then" ? (resolve: (v: unknown) => void) => resolve(empty) : chain,
    apply: () => chain,
  });
  return {
    supabaseConfigured: true,
    supabase: new Proxy(
      {
        auth: {
          getSession: async () => ({ data: { session }, error: null }),
          signInAnonymously: async () => ({ data: { session }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        },
      },
      { get: (t, key) => (key in t ? t[key as keyof typeof t] : chain) },
    ),
  };
});

// No notification launched the app (the native module's auto-mock returns a
// truthy stub here).
jest.mock("expo-notifications", () => ({
  ...jest.requireActual("expo-notifications"),
  getLastNotificationResponse: () => null,
  clearLastNotificationResponse: () => {},
}));

// Generous timeout: importing every route is slow on a cold transform cache.
it("boots to Home and switches tabs", async () => {
  // The app directory itself, so every route module is imported.
  await renderRouter("src/app", { initialUrl: "/" });
  expect(await screen.findByText("Where to?")).toBeTruthy();
  expect(screen.getByTestId("home-create")).toBeTruthy();

  await fireEvent.press(screen.getByTestId("tab-trips"));
  expect(await screen.findByText("Past")).toBeTruthy();
  await fireEvent.press(screen.getByTestId("tab-profile"));
  expect(await screen.findByText("Your name")).toBeTruthy();
}, 60_000);

it("creates a room and lands on its map", async () => {
  const room = { id: "r1", code: "ABC123", name: "Our trip", mode: "converge", host_id: "u1" };
  const create = jest
    .spyOn(roomsRpc, "createRoom")
    .mockResolvedValue({ ok: true, room, member: { user_id: "u1", role: "traveler" } } as never);
  // Kept, not awaited inline: with RNTL 14 getPathname sits on the promise.
  const app = renderRouter("src/app", { initialUrl: "/" });
  await app;
  await screen.findByText("Where to?");
  // Location consent already given (its prompt is a native sheet).
  useSessionStore.setState({ primedLocation: true });
  await fireEvent.press(screen.getByTestId("home-create"));
  expect(await screen.findByText("Choose a mode")).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId("create-your-name"), "Maestro");
  await fireEvent.press(screen.getByTestId("create-submit"));
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Maestro" }));
  expect(app.getPathname()).toBe("/room/r1");
  // The room screen mounted: map chrome plus the sheet's header actions.
  expect(await screen.findByTestId("room-invite")).toBeTruthy();
  expect(screen.getByTestId("room-recenter")).toBeTruthy();
}, 60_000);
