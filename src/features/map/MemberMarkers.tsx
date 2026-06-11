import { Marker } from "@maplibre/maplibre-react-native";
import { StyleSheet, Text, View } from "react-native";

import { colorForUser, colors } from "@/constants/theme";
import { presenceOf } from "@/stores/membersStore";
import type { MemberLive } from "@/types/contracts";

interface MemberMarkersProps {
  members: MemberLive[];
  nowMs: number;
}

export function MemberMarkers({ members, nowMs }: MemberMarkersProps) {
  return (
    <>
      {members
        .filter((m) => m.pos)
        .map((m) => {
          const state = presenceOf(m, nowMs);
          const faded = state === "offline" || state === "reconnecting";
          return (
            <Marker
              key={m.userId}
              id={m.userId}
              lngLat={[m.pos!.lng, m.pos!.lat]}
              anchor="center"
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
                <View style={[styles.avatar, { backgroundColor: colorForUser(m.userId) }]}>
                  <Text style={styles.initial}>{m.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {m.name}
                </Text>
              </View>
            </Marker>
          );
        })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: 84 },
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
    borderColor: "#FFFFFF",
    elevation: 4,
  },
  initial: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  name: {
    marginTop: 2,
    color: colors.text,
    backgroundColor: "rgba(15,17,21,0.75)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontSize: 11,
    fontWeight: "600",
    overflow: "hidden",
  },
});
