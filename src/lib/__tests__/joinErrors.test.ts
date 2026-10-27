import { isTerminalJoinError, joinErrorMessage, rejoinErrorMessage } from "@/lib/joinErrors";

describe("join error classification", () => {
  it("forgets a remembered room only when rejoin can never succeed", () => {
    expect(isTerminalJoinError("room_ended")).toBe(true);
    expect(isTerminalJoinError("bad_code")).toBe(true);
    expect(isTerminalJoinError("kicked")).toBe(true);
    // Transient: a blip, a full or locked room must keep the rejoin card.
    expect(isTerminalJoinError("network")).toBe(false);
    expect(isTerminalJoinError("room_full")).toBe(false);
    expect(isTerminalJoinError("room_locked")).toBe(false);
  });

  it("words a vanished remembered room as ended, not mistyped", () => {
    expect(joinErrorMessage("bad_code")).toMatch(/double-check/);
    expect(rejoinErrorMessage("bad_code")).toBe("That room has ended.");
    expect(rejoinErrorMessage("kicked")).toBe("You were removed from this room.");
    expect(rejoinErrorMessage("network")).toMatch(/connection/);
  });
});
