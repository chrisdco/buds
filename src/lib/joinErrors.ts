import type { RpcError } from "@/types/contracts";

// Shared copy + classification for join_room failures, used by every entry
// point (code form, deep link, Home rejoin, Trips rejoin) so they can't drift.
// Lives outside src/app: route files should export only their screen.

export function joinErrorMessage(error: RpcError): string {
  switch (error) {
    case "bad_code":
      return "Room not found — double-check the code.";
    case "room_full":
      return "All traveler spots are taken.";
    case "room_locked":
      return "The host has locked this room.";
    case "room_ended":
      return "That room has ended.";
    case "kicked":
      return "You were removed from this room.";
    case "bad_display_name":
      return "Please enter a valid name (1–24 characters).";
    default:
      return "Couldn't join — check your connection and try again.";
  }
}

/**
 * True when retrying can never succeed (the room is gone or we're barred
 * from it), so a remembered room should be forgotten. Transient failures
 * (network, full, locked) keep it: a blip must not erase the rejoin card.
 */
export function isTerminalJoinError(error: RpcError): boolean {
  return error === "room_ended" || error === "bad_code" || error === "kicked";
}

/** Rejoin copy: a remembered room that "isn't found" has ended, not been mistyped. */
export function rejoinErrorMessage(error: RpcError): string {
  return error === "bad_code" ? "That room has ended." : joinErrorMessage(error);
}
