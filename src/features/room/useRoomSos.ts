import * as Haptics from "expo-haptics";
import { useCallback, useMemo } from "react";

import type { SosBannerItem } from "@/features/room/SosBanner";
import { serverOffsetMs } from "@/lib/time";
import { roomsRpc } from "@/services/rpc/rooms";
import { activeSos, useMembersStore } from "@/stores/membersStore";
import { useUiStore } from "@/stores/uiStore";
import type { MemberLive } from "@/types/contracts";

// SOS for the room screen (#45): the banner rows for peers' active alerts and
// our own raise/clear actions. State is server-attested (room_members.sos_at
// via set_sos), so this hook only reads the store and calls the RPC.

export function useRoomSos(args: {
  roomId: string | undefined;
  myUserId: string | null;
  isTraveler: boolean;
  membersMap: Record<string, MemberLive>;
  nowMs: number;
}) {
  const { roomId, myUserId, isTraveler, membersMap, nowMs } = args;
  const sosByUser = useMembersStore((s) => s.sosByUser);

  // Recomputed on the 5s tick so expired entries clear without new traffic.
  // SOS stamps are server times (set_sos writes now()), so TTL + freshness
  // compare on the same server basis: a receiver whose clock runs fast must
  // not see a live SOS as already expired.
  const sosNowMs = nowMs + serverOffsetMs();

  // Own SOS excluded from the banner — the sender gets FAB state instead.
  const items: SosBannerItem[] = useMemo(() => {
    const out: SosBannerItem[] = [];
    for (const { userId, atMs } of activeSos(sosByUser, sosNowMs)) {
      if (userId === myUserId) continue;
      const m = membersMap[userId];
      if (!m) continue;
      out.push({
        userId,
        name: m.name,
        atMs,
        pos: m.pos ? { lat: m.pos.lat, lng: m.pos.lng } : null,
      });
    }
    return out;
  }, [sosByUser, membersMap, sosNowMs, myUserId]);

  const mySosActive =
    myUserId != null && activeSos(sosByUser, sosNowMs).some((i) => i.userId === myUserId);

  // Explicit panic action: confirm-gated send (an SOS alarms the whole room),
  // frictionless cancel (a resolved emergency shouldn't fight UI). Travelers
  // only — spectators just watch (set_sos enforces it too).
  const send = useCallback(() => {
    if (!myUserId || !isTraveler || !roomId) return;
    void (async () => {
      const ok = await useUiStore.getState().requestConfirm({
        title: "Send SOS to the room?",
        body: "Everyone in the room gets an urgent alert with your live location.",
        confirmLabel: "Send SOS",
        destructive: true,
      });
      if (!ok) return;
      // Peers learn of it through the member_change broadcast; the returned
      // row mirrors locally right away (applying the echo twice is a no-op).
      const res = await roomsRpc.setSos(roomId, true);
      if (!res.ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        useUiStore.getState().pushAlerts([
          {
            id: "sos-failed",
            severity: "warn",
            title: "SOS didn't send",
            body: "Check your connection and try again — or call for help directly.",
          },
        ]);
        return;
      }
      useMembersStore.getState().applyMemberRow(res.member);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      useUiStore.getState().pushAlerts([
        { id: "sos-sent", severity: "warn", title: "SOS sent — your room can see you" },
      ]);
    })();
  }, [myUserId, isTraveler, roomId]);

  const cancel = useCallback(() => {
    if (!myUserId || !roomId) return;
    void (async () => {
      const res = await roomsRpc.setSos(roomId, false);
      if (!res.ok) {
        useUiStore.getState().pushAlerts([
          { id: "sos-clear-failed", severity: "info", title: "Couldn't clear SOS — try again" },
        ]);
        return;
      }
      useMembersStore.getState().applyMemberRow(res.member);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      useUiStore.getState().pushAlerts([{ id: "sos-cleared", severity: "info", title: "SOS cleared" }]);
    })();
  }, [myUserId, roomId]);

  return { items, sosNowMs, mySosActive, send, cancel };
}
