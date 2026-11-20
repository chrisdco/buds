// The destination search screen, rendered through the real router: category
// chips search and toggle, recents show distance from you, a pick seeds the
// map's adjust-pin draft and goes back. Search itself is mocked (no network).
import { act, fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import { Text } from "react-native";

import DestSearchScreen from "@/app/room/[id]/dest-search";
import { searchPlaces } from "@/services/places/search";
import { useMembersStore } from "@/stores/membersStore";
import { usePlacesStore } from "@/stores/placesStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

jest.mock("@/services/places/search", () => ({
  ...jest.requireActual("@/services/places/search"),
  searchPlaces: jest.fn(),
}));
const mockSearch = searchPlaces as jest.MockedFunction<typeof searchPlaces>;

const ME = "me";
// About 1.1 km north of "me".
const RECENT = { name: "Corner Cafe", address: "Hill Rd", lat: 19.086, lng: 72.8777, atMs: 1 };

function place(id: string, name: string, distanceM: number) {
  return { id, name, address: "Somewhere", lat: 19, lng: 72, distanceM, kind: "fuel" };
}

// Opened from the room map, like the app does, so back has somewhere to go.
// RNTL 14 renders async: renderRouter's helpers (getPathname) sit on the
// returned promise itself, so keep it and await it separately.
async function open() {
  const result = renderRouter(
    {
      "room/[id]/index": () => <Text>room map</Text>,
      "room/[id]/dest-search": DestSearchScreen,
    },
    { initialUrl: "/room/r1" },
  );
  await result;
  await act(() => router.push("/room/r1/dest-search"));
  // Not `return result`: an async function would unwrap it again.
  return { pathname: () => result.getPathname() };
}

beforeEach(() => {
  mockSearch.mockReset();
  useSessionStore.setState({ userId: ME, units: "km" });
  useMembersStore.setState({
    members: { [ME]: { pos: { lat: 19.076, lng: 72.8777, atMs: Date.now(), source: "tick" } } } as never,
  });
  usePlacesStore.setState({ recents: [RECENT], addRecent: jest.fn(() => Promise.resolve()) });
  useUiStore.getState().setDestDraft(null as never);
});

it("shows recents with their distance from you", async () => {
  await open();
  expect(screen.getByText("Corner Cafe")).toBeTruthy();
  expect(screen.getByText("1.1 km")).toBeTruthy();
});

it("a category chip searches nearby, nearest first, and toggles off", async () => {
  mockSearch.mockResolvedValue([place("a", "Far Pump", 2400), place("b", "Near Pump", 300)]);
  await open();
  await fireEvent.press(screen.getByTestId("dest-search-cat-petrol"));
  expect(screen.getByDisplayValue("Petrol station")).toBeTruthy();
  const names = (await screen.findAllByText(/Pump$/)).map((n) => n.props.children);
  expect(names).toEqual(["Near Pump", "Far Pump"]);
  expect(mockSearch).toHaveBeenCalledWith("Petrol station", { lat: 19.076, lng: 72.8777 }, 8, expect.anything());

  await fireEvent.press(screen.getByTestId("dest-search-cat-petrol"));
  expect(screen.queryByDisplayValue("Petrol station")).toBeNull();
  expect(screen.getByText("Corner Cafe")).toBeTruthy();
});

it("picking a recent seeds the pin draft and returns to the map", async () => {
  const app = await open();
  await fireEvent.press(screen.getByTestId("dest-search-recent-0"));
  expect(useUiStore.getState().destDraft).toMatchObject({ lat: RECENT.lat, lng: RECENT.lng, label: "Corner Cafe" });
  expect(usePlacesStore.getState().addRecent).toHaveBeenCalled();
  expect(app.pathname()).toBe("/room/r1");
  expect(screen.getByText("room map")).toBeTruthy();
});

it("search failure shows the offline-safe message", async () => {
  mockSearch.mockRejectedValue(new Error("network"));
  await open();
  await fireEvent.changeText(screen.getByTestId("dest-search-field"), "Pharmacy");
  expect(await screen.findByText(/Couldn't search/)).toBeTruthy();
});
