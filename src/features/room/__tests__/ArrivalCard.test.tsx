import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";

import { ArrivalCard } from "@/features/room/ArrivalCard";
import type { ArrivalMoment } from "@/features/room/arrival";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success" },
}));

const solo: ArrivalMoment = { kind: "self", key: "r1:self:t", rank: 1, total: 1, remaining: 0 };
const group: ArrivalMoment = { kind: "self", key: "r1:self:t2", rank: 2, total: 3, remaining: 1 };
const all: ArrivalMoment = { kind: "all", key: "r1:all", total: 3 };

describe("ArrivalCard", () => {
  it("solo host: arrived card with End trip", async () => {
    const onPress = jest.fn();
    await render(
      <ArrivalCard
        moment={solo}
        viewer="host"
        top={0}
        wrapUp={{ label: "End trip", onPress }}
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByTestId("arrival-card-self")).toBeTruthy();
    expect(screen.getByText("You've arrived")).toBeTruthy();
    expect(screen.getByText(/End the trip so everyone stops sharing/)).toBeTruthy();
    await fireEvent.press(screen.getByText("End trip"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("group traveler: placement line, no wrap-up button", async () => {
    await render(<ArrivalCard moment={group} viewer="traveler" top={0} wrapUp={null} onDismiss={jest.fn()} />);
    expect(screen.getByText("2nd of 3 · 1 still on the way")).toBeTruthy();
    expect(screen.queryByTestId("arrival-wrap-up")).toBeNull();
  });

  it("everyone's here, for a watcher", async () => {
    await render(<ArrivalCard moment={all} viewer="watcher" top={0} wrapUp={null} onDismiss={jest.fn()} />);
    expect(screen.getByTestId("arrival-card-all")).toBeTruthy();
    expect(screen.getByText("Everyone's here")).toBeTruthy();
    expect(screen.getByText("The host can end the trip.")).toBeTruthy();
  });

  it("dismiss calls back; the haptic fires once per moment", async () => {
    const onDismiss = jest.fn();
    const moment: ArrivalMoment = { ...solo, key: "r9:self:once" };
    const before = (Haptics.notificationAsync as jest.Mock).mock.calls.length;
    const { unmount } = await render(
      <ArrivalCard moment={moment} viewer="host" top={0} wrapUp={null} onDismiss={onDismiss} />,
    );
    await fireEvent.press(screen.getByTestId("arrival-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    await unmount();
    // Remount (back from settings): no second tick.
    await render(<ArrivalCard moment={moment} viewer="host" top={0} wrapUp={null} onDismiss={onDismiss} />);
    expect((Haptics.notificationAsync as jest.Mock).mock.calls.length - before).toBe(1);
  });
});
