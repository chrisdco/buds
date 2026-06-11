import { createArrivalDetector } from "@/events/arrivalDetector";

describe("createArrivalDetector", () => {
  const radiusM = () => 75;

  it("fires only after being inside the radius for the sustain window", () => {
    const onArrive = jest.fn();
    const detector = createArrivalDetector({ radiusM, onArrive });
    detector.update(50, 0);
    detector.update(50, 5_000);
    expect(onArrive).not.toHaveBeenCalled();
    detector.update(50, 10_000);
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it("does not fire when driving past the destination", () => {
    const onArrive = jest.fn();
    const detector = createArrivalDetector({ radiusM, onArrive });
    detector.update(50, 0);
    detector.update(200, 4_000); // left the radius before sustain elapsed
    detector.update(50, 8_000); // back in: the clock restarts
    detector.update(50, 17_000);
    expect(onArrive).not.toHaveBeenCalled();
    detector.update(50, 18_100);
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it("does not refire from GPS wobble at the destination", () => {
    const onArrive = jest.fn();
    const detector = createArrivalDetector({ radiusM, onArrive });
    detector.update(10, 0);
    detector.update(10, 10_000); // fires
    detector.update(120, 11_000); // wobble out (within 2x radius)
    detector.update(10, 12_000);
    detector.update(10, 25_000);
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it("re-arms after moving well clear of the destination", () => {
    const onArrive = jest.fn();
    const detector = createArrivalDetector({ radiusM, onArrive });
    detector.update(10, 0);
    detector.update(10, 10_000); // fires
    detector.update(400, 20_000); // well outside 2x radius -> re-armed
    detector.update(10, 30_000);
    detector.update(10, 40_000);
    expect(onArrive).toHaveBeenCalledTimes(2);
  });
});
