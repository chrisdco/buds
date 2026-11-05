import { Marker } from "@maplibre/maplibre-react-native";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PeepAvatar } from "@/components/PeepAvatar";
import { colorForUser, colors } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { presenceOf } from "@/stores/membersStore";
import type { MemberLive } from "@/types/contracts";

interface MemberMarkersProps {
  members: MemberLive[];
  nowMs: number;
  /** Self marker gets the Maps-style treatment (accent halo). */
  myUserId?: string | null;
  /** Focused members get a bright ring (subset-focus set). */
  selectedIds?: string[];
  /** Toggles focus membership; omitted = markers not tappable. */
  onToggleFocus?: (userId: string) => void;
  /** Route ETA (seconds) per member, shown as a chip in the name pill. */
  etaByUser?: Record<string, number>;
}

const FACE = 30;
const RING = 3;
const DOT = FACE + RING * 2 + 4; // face + color ring + white edge

// The same Open Peeps face a member has in every list, ringed in their map
// color so face, ring and route line all say "this is Asha". Memoized: the
// face SVG is heavy and only depends on who it is, not on position ticks.
const Face = memo(function Face({ userId }: { userId: string }) {
  return <PeepAvatar seed={userId} size={FACE} />;
});

export function MemberMarkers({
  members,
  nowMs,
  myUserId,
  selectedIds,
  onToggleFocus,
  etaByUser,
}: MemberMarkersProps) {
  const selected = new Set(selectedIds ?? []);
  return (
    <>
      {members
        .filter((m) => m.pos)
        .map((m) => {
          const state = presenceOf(m, nowMs);
          const faded = state === "offline" || state === "reconnecting";
          const isSelf = myUserId != null && m.userId === myUserId;
          const color = colorForUser(m.userId);
          const etaS = etaByUser?.[m.userId];
          const heading = m.pos!.heading;
          return (
            <Marker
              key={m.userId}
              id={m.userId}
              lngLat={[m.pos!.lng, m.pos!.lat]}
              anchor="center"
              onPress={onToggleFocus ? () => onToggleFocus(m.userId) : undefined}
            >
              <View style={[styles.wrap, faded && styles.faded]}>
                <View style={styles.dotArea}>
                  {isSelf && <View style={styles.selfHalo} />}
                  {/* Heading cone: a wedge riding the ring's edge, rotated
                  with the device bearing, only while actually moving. */}
                  {heading != null && state === "moving" && (
                    <View style={[styles.cone, { transform: [{ rotate: `${Math.round(heading)}deg` }] }]}>
                      <View style={[styles.coneTip, { borderBottomColor: color }]} />
                    </View>
                  )}
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: color },
                      (isSelf || selected.has(m.userId)) && styles.dotEmphasis,
                    ]}
                  >
                    <Face userId={m.userId} />
                  </View>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.name} numberOfLines={1}>
                    {isSelf ? "You" : m.name}
                  </Text>
                  {etaS != null && (
                    <View style={[styles.eta, { backgroundColor: color }]}>
                      <Text style={styles.etaText}>{Math.max(1, Math.round(etaS / 60))} min</Text>
                    </View>
                  )}
                  {faded && <Text style={styles.offline}>{state === "offline" ? "Offline" : "…"}</Text>}
                </View>
              </View>
            </Marker>
          );
        })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: 150 },
  faded: { opacity: 0.5 },
  dotArea: { width: DOT + 16, height: DOT + 16, alignItems: "center", justifyContent: "center" },
  // Self: soft accent halo (Maps blue-dot language) behind the face.
  selfHalo: {
    position: "absolute",
    width: DOT + 16,
    height: DOT + 16,
    borderRadius: (DOT + 16) / 2,
    backgroundColor: "rgba(79,142,247,0.22)",
  },
  cone: { position: "absolute", width: DOT + 14, height: DOT + 14, alignItems: "center" },
  coneTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.text,
    elevation: 4,
  },
  dotEmphasis: { borderWidth: 3 },
  // Rounded name pill: our own callout, softer than Uber's square box.
  pill: {
    marginTop: -2,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingLeft: 9,
    paddingRight: 4,
    paddingVertical: 3,
    maxWidth: 150,
    elevation: 3,
  },
  name: {
    color: colors.text,
    fontSize: 12,
    fontFamily: fontFamily.semiBold,
    flexShrink: 1,
    paddingRight: 5,
  },
  eta: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  etaText: { color: colors.onPrimary, fontSize: 11, fontFamily: fontFamily.bold, fontVariant: ["tabular-nums"] },
  offline: { color: colors.textDim, fontSize: 11, fontFamily: fontFamily.medium, paddingRight: 5 },
});
