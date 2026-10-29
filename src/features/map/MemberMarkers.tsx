import { Marker } from "@maplibre/maplibre-react-native";
import { StyleSheet, Text, View } from "react-native";

import { colorForUser, colors } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { presenceOf } from "@/stores/membersStore";
import type { MemberLive } from "@/types/contracts";

interface MemberMarkersProps {
  members: MemberLive[];
  nowMs: number;
  /** Self marker gets the Maps-style treatment (accent ring). */
  myUserId?: string | null;
  /** Focused members get a bright ring (subset-focus set). */
  selectedIds?: string[];
  /** Toggles focus membership; omitted = markers not tappable. */
  onToggleFocus?: (userId: string) => void;
  /** Route ETA (seconds) per member: Uber's "1 MIN" box beside the label. */
  etaByUser?: Record<string, number>;
}

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
          return (
            <Marker
              key={m.userId}
              id={m.userId}
              lngLat={[m.pos!.lng, m.pos!.lat]}
              anchor="center"
              onPress={onToggleFocus ? () => onToggleFocus(m.userId) : undefined}
            >
              <View style={[styles.wrap, faded && styles.faded]}>
                {m.pos!.heading != null && state === "moving" && (
                  <View
                    style={[
                      styles.headingArrow,
                      { transform: [{ rotate: `${Math.round(m.pos!.heading)}deg` }] },
                    ]}
                  >
                    <View style={[styles.arrowTip, { borderBottomColor: colorForUser(m.userId) }]} />
                  </View>
                )}
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: colorForUser(m.userId) },
                    isSelf && styles.selfAvatar,
                    !isSelf && selected.has(m.userId) && styles.selectedAvatar,
                  ]}
                >
                  <Text style={styles.initial}>{m.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.callout}>
                  {etaByUser?.[m.userId] != null && (
                    <View style={styles.etaBox}>
                      <Text style={styles.etaNum}>
                        {Math.max(1, Math.round(etaByUser[m.userId] / 60))}
                      </Text>
                      <Text style={styles.etaUnit}>MIN</Text>
                    </View>
                  )}
                  <Text style={styles.name} numberOfLines={1}>
                    {isSelf ? "You" : m.name}
                  </Text>
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
  faded: { opacity: 0.45 },
  headingArrow: {
    position: "absolute",
    top: -2,
    width: 44,
    height: 44,
    alignItems: "center",
  },
  arrowTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.text,
    elevation: 4,
  },
  /** Self marker: accent ring instead of white (Maps blue-dot language). */
  selfAvatar: { borderColor: colors.accent, borderWidth: 3 },
  /** Focused member: bright ring so the camera set reads on the map. */
  selectedAvatar: { borderColor: colors.text, borderWidth: 3 },
  initial: { color: colors.text, fontFamily: fontFamily.bold, fontSize: 15 },
  // Uber callout: square black box; the ETA box (white, number over MIN)
  // sits on its leading edge like the pickup label in the references.
  callout: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#000000",
    borderRadius: 2,
    overflow: "hidden",
    maxWidth: 150,
  },
  etaBox: {
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  etaNum: { color: colors.onPrimary, fontSize: 13, lineHeight: 15, fontFamily: fontFamily.bold },
  etaUnit: { color: colors.onPrimary, fontSize: 8, lineHeight: 10, fontFamily: fontFamily.semiBold },
  name: {
    color: colors.text,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 13,
    fontFamily: fontFamily.semiBold,
    flexShrink: 1,
  },
});
