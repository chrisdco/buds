import { Marker } from "@maplibre/maplibre-react-native";
import { StyleSheet, Text, View } from "react-native";

import { colorForUser, colors } from "@/constants/theme";
import type { DestRow, MemberLive } from "@/types/contracts";

interface DestinationMarkersProps {
  destRoom: DestRow | null;
  destByMember: Record<string, DestRow>;
  members: Record<string, MemberLive>; // keyed by user_id, for pin colors
}

export function DestinationMarkers({
  destRoom,
  destByMember,
  members,
}: DestinationMarkersProps) {
  const memberByMemberId = new Map(
    Object.values(members).map((m) => [m.memberId, m]),
  );
  return (
    <>
      {destRoom && (
        <Marker id="dest-room" lngLat={[destRoom.lng, destRoom.lat]} anchor="bottom">
          <View style={styles.wrap}>
            <Text style={styles.label} numberOfLines={1}>
              {destRoom.label}
            </Text>
            <View style={[styles.pin, { backgroundColor: colors.accent }]}>
              <Text style={styles.pinGlyph}>⚑</Text>
            </View>
            <View style={[styles.tip, { borderTopColor: colors.accent }]} />
          </View>
        </Marker>
      )}
      {Object.values(destByMember).map((d) => {
        if (!d.member_id) return null;
        const owner = memberByMemberId.get(d.member_id);
        const color = owner ? colorForUser(owner.userId) : colors.textDim;
        return (
          <Marker key={d.id} id={`dest-${d.id}`} lngLat={[d.lng, d.lat]} anchor="bottom">
            <View style={styles.wrap}>
              {owner && (
                <Text style={styles.label} numberOfLines={1}>
                  {owner.name}
                </Text>
              )}
              <View style={[styles.pin, styles.pinSmall, { backgroundColor: color }]}>
                <Text style={styles.pinGlyphSmall}>●</Text>
              </View>
              <View style={[styles.tip, { borderTopColor: color }]} />
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  label: {
    color: colors.text,
    backgroundColor: "rgba(15,17,21,0.75)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
    maxWidth: 110,
    overflow: "hidden",
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  pinSmall: { width: 22, height: 22, borderRadius: 11 },
  pinGlyph: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  pinGlyphSmall: { color: "#FFFFFF", fontSize: 9 },
  tip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
});
