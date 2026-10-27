import type { CameraRef, LngLat, MapRef } from "@maplibre/maplibre-react-native";
import { useEffect, useRef, useState, type RefObject } from "react";

import type { SheetDetent } from "@/features/room/RoomSheet";
import type { ModeStrategy } from "@/modes/types";
import { ensureTripPack } from "@/services/map/offlinePacks";
import { roomsRpc } from "@/services/rpc/rooms";
import { useUiStore } from "@/stores/uiStore";
import type { MemberLive, RoomRow } from "@/types/contracts";

// Picking a destination on the room map: long-press or a search pick seeds
// adjust-pin mode, the user drags the map to fine-tune, then confirms. The pin
// is drawn at the exact map center, so the camera flies the pick there and
// every confirm reads getCenter() — what the pin points at is what's saved.

export interface AdjustDraft {
  lat: number;
  lng: number;
  label: string;
}

function setDestinationAndWarm(args: Parameters<typeof roomsRpc.setDestination>[0]): void {
  void roomsRpc.setDestination(args).then((r) => {
    if (!r.ok) {
      useUiStore.getState().pushAlerts([
        { id: "dest-err", severity: "warn", title: "Couldn't set destination" },
      ]);
    } else {
      void ensureTripPack(args.lat, args.lng);
    }
  });
}

export function useDestinationPicker(args: {
  room: RoomRow | null;
  myUserId: string | null;
  myMemberId: string | null;
  membersMap: Record<string, MemberLive>;
  strategy: ModeStrategy;
  isHost: boolean;
  cameraRef: RefObject<CameraRef | null>;
  mapRef: RefObject<MapRef | null>;
  detent: SheetDetent;
  setDetent: (d: SheetDetent) => void;
}) {
  const { room, myUserId, myMemberId, membersMap, strategy, isHost } = args;
  const { cameraRef, mapRef, detent, setDetent } = args;
  const destDraft = useUiStore((s) => s.destDraft);
  // Coords track the live map center while active.
  const [adjust, setAdjust] = useState<AdjustDraft | null>(null);
  // Detent to restore when adjust-pin mode ends: adjusting drops the sheet to
  // peek so the screen-centered pin (= the map center) is never covered.
  const detentBeforeAdjust = useRef<SheetDetent | null>(null);

  const begin = (lat: number, lng: number, label: string, zoom?: number) => {
    if (detentBeforeAdjust.current == null) detentBeforeAdjust.current = detent;
    setDetent("peek");
    cameraRef.current?.easeTo({ center: [lng, lat], ...(zoom != null ? { zoom } : {}), duration: 600 });
    setAdjust({ lat, lng, label });
  };

  const end = () => {
    setAdjust(null);
    if (detentBeforeAdjust.current != null) {
      setDetent(detentBeforeAdjust.current);
      detentBeforeAdjust.current = null;
    }
  };

  const onLongPress = (lngLat: LngLat) => {
    if (!room || !myUserId) return;
    const [lng, lat] = lngLat;
    const policy = strategy.destinationPolicy;

    if (membersMap[myUserId]?.role === "spectator") {
      useUiStore.getState().pushAlerts([
        { id: "dest-spectator", severity: "info", title: "Spectators just watch" },
      ]);
      return;
    }

    if (policy === "room") {
      if (!isHost) {
        useUiStore.getState().pushAlerts([
          {
            id: "dest-host-only",
            severity: "info",
            title: "Only the host sets the destination in this mode",
          },
        ]);
        return;
      }
      begin(lat, lng, "Meet point");
      return;
    }

    if (policy === "leader-position" && room.leader_id !== myUserId) {
      const leaderName = room.leader_id
        ? (membersMap[room.leader_id]?.name ?? "the leader")
        : "the leader";
      useUiStore.getState().pushAlerts([
        { id: "dest-follow", severity: "info", title: `You're following ${leaderName}` },
      ]);
      return;
    }

    begin(lat, lng, "Destination");
  };

  // Search picks land here via the store: fly the pin into view, then hand to
  // adjust mode so the same policy gates + confirm apply. Deferred to a
  // microtask: consuming external-store state synchronously in an effect is a
  // cascading-render hazard (zigzag: search screen set -> this effect set).
  useEffect(() => {
    if (!destDraft) return;
    const draft = destDraft;
    queueMicrotask(() => {
      useUiStore.getState().setDestDraft(null);
      begin(draft.lat, draft.lng, draft.label, 15);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destDraft]);

  // While adjusting, the pin stays screen-centered: track the live map center
  // as the user drags (fires on gesture end, not per frame).
  const onRegionChange = () => {
    if (!adjust) return;
    void mapRef.current
      ?.getCenter()
      .then(([lng, lat]) => {
        setAdjust((prev) => (prev ? { ...prev, lat, lng } : prev));
      })
      .catch(() => {});
  };

  const confirm = () => {
    if (!room || !myUserId || !adjust) return;
    const { lat, lng, label } = adjust;
    const roomLevel = strategy.destinationPolicy === "room";
    void (async () => {
      const ok = await useUiStore.getState().requestConfirm(
        roomLevel
          ? {
              title: "Set room destination?",
              body: `${label} — everyone will head here.`,
              confirmLabel: "Set destination",
              destructive: false,
            }
          : {
              title: "Set your destination?",
              body: label,
              confirmLabel: "Set destination",
              destructive: false,
            },
      );
      if (ok) {
        if (roomLevel) {
          setDestinationAndWarm({ roomId: room.id, lat, lng, label });
        } else if (myMemberId) {
          setDestinationAndWarm({ roomId: room.id, lat, lng, label, memberId: myMemberId });
        }
      }
      end();
    })();
  };

  return { adjust, onLongPress, onRegionChange, confirm, cancel: end };
}
