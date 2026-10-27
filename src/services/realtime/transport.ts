import type { PresenceMeta } from "@/types/contracts";

// The seam between "how bytes reach the room" and "what the app does with
// them". A transport only moves opaque payloads on named events and reports
// liveness; validation, versioning and every store write live in
// roomDispatch / roomChannel. Swapping Supabase Realtime for another backend
// (architecture review R3: a Durable Object per room) means writing one new
// RoomTransport, not touching the app.

/** Peer-to-peer events the client sends and receives. */
export type PeerEvent = "loc" | "evt";

/** Server-originated control-plane events (DB-change broadcasts). */
export type ControlEvent = "room_change" | "member_change" | "dest_change";

export type TransportStatus = "connected" | "reconnecting";

export interface RoomTransportHandlers {
  onPeer(event: PeerEvent, payload: unknown): void;
  onControl(event: ControlEvent, payload: unknown): void;
  /** Full presence state keyed by member user id (each may have several devices). */
  onPresence(state: Record<string, PresenceMeta[]>): void;
  /** "connected" on every (re)join; "reconnecting" on errors, timeouts, closes. */
  onStatus(status: TransportStatus): void;
}

/**
 * One instance per room connection. After close(), an implementation must
 * not invoke handlers again (late socket callbacks are swallowed), so a torn
 * down connection can never write into the next room's state.
 */
export interface RoomTransport {
  /** Starts joining; rejects when the connection can't even be attempted (auth). */
  open(roomId: string, presenceKey: string, handlers: RoomTransportHandlers): Promise<void>;
  close(): Promise<void>;
  /** True only when a send will actually reach peers right now. */
  isLive(): boolean;
  /** Fire-and-forget; never throws (hot path: every GPS fix). */
  send(event: PeerEvent, payload: object): void;
  /** Publishes our presence meta; fire-and-forget. */
  track(meta: PresenceMeta): void;
}

export type RoomTransportFactory = () => RoomTransport;
