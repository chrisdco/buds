import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabaseClient";
import type {
  ControlEvent,
  PeerEvent,
  RoomTransport,
  RoomTransportHandlers,
} from "@/services/realtime/transport";
import type { PresenceMeta } from "@/types/contracts";

// Supabase Realtime implementation: one private channel per room
// ("room:<uuid>", authorized by RLS on realtime.messages) carries all three
// planes — client broadcast ('loc'/'evt'), presence, and the DB-change
// broadcasts from triggers. supabase-js reconnects the socket with backoff
// and rejoins channels by itself; each rejoin surfaces as "connected".

const CONTROL_EVENTS: ControlEvent[] = ["room_change", "member_change", "dest_change"];
const PEER_EVENTS: PeerEvent[] = ["loc", "evt"];

/** Fire-and-forget a promise without tripping unhandled-rejection warnings. */
function ignoreRejection(p: Promise<unknown> | null | undefined): void {
  if (p && typeof (p as Promise<unknown>).catch === "function") {
    void (p as Promise<unknown>).catch(() => {});
  }
}

export function createSupabaseTransport(): RoomTransport {
  let channel: RealtimeChannel | null = null;
  let closed = false;

  return {
    async open(roomId, presenceKey, handlers: RoomTransportHandlers) {
      // Private channels are authorized via RLS; the socket must carry the
      // current access token before joining. Rejects on an expired session
      // or offline — the caller maps that to "reconnecting".
      await supabase.realtime.setAuth();
      if (closed) return; // closed while authorizing

      const ch = supabase.channel(`room:${roomId}`, {
        config: {
          private: true,
          broadcast: { self: false, ack: false },
          presence: { key: presenceKey },
        },
      });
      channel = ch;

      for (const event of PEER_EVENTS) {
        ch.on("broadcast", { event }, ({ payload }) => {
          if (!closed) handlers.onPeer(event, payload);
        });
      }
      for (const event of CONTROL_EVENTS) {
        ch.on("broadcast", { event }, ({ payload }) => {
          if (!closed) handlers.onControl(event, payload);
        });
      }
      ch.on("presence", { event: "sync" }, () => {
        if (!closed) handlers.onPresence(ch.presenceState<PresenceMeta>());
      });
      ch.subscribe((status) => {
        if (closed) return;
        if (status === "SUBSCRIBED") {
          handlers.onStatus("connected");
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          handlers.onStatus("reconnecting");
        }
      });
    },

    async close() {
      closed = true;
      const ch = channel;
      channel = null;
      if (!ch) return;
      try {
        await supabase.removeChannel(ch);
      } catch {
        // Server-side unsubscribe failed; the socket drops it on reconnect.
        // Never fail teardown.
      }
    },

    isLive() {
      return !closed && supabase.realtime.isConnected() && channel?.state === "joined";
    },

    send(event, payload) {
      // A flapping socket rejects sends — swallow, never redbox per tick.
      if (!closed) ignoreRejection(channel?.send({ type: "broadcast", event, payload }));
    },

    track(meta) {
      if (!closed) ignoreRejection(channel?.track(meta));
    },
  };
}
