import { memo, type ReactNode } from "react";

import { Marker } from "@maplibre/maplibre-react-native";
import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colorForUser, onHue } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import type { DestRow, MemberLive } from "@/types/contracts";
import { makeStyles, useColors } from "@/theme";

interface DestinationMarkersProps {
  destRoom: DestRow | null;
  destByMember: Record<string, DestRow>;
  members: Record<string, MemberLive>; // keyed by user_id, for pin colors
}

/**
 * Teardrop map pin with a white rim, drawn as one SVG path so the point is
 * exact (anchor="bottom" lands the tip on the coordinate). `inner` sits in
 * the round head.
 */
function Pin({ size, color, inner }: { size: number; color: string; inner?: ReactNode }) {
  const styles = useStyles();
  const colors = useColors();
  const h = size * 1.3;
  return (
    <View style={{ width: size, height: h }}>
      <Svg width={size} height={h} viewBox="0 0 40 52">
        <Path
          d="M20 51C20 51 37.5 32.5 37.5 19.5C37.5 9.8 29.7 2 20 2C10.3 2 2.5 9.8 2.5 19.5C2.5 32.5 20 51 20 51Z"
          fill={color}
          stroke={colors.text}
          strokeWidth={2.5}
        />
        {inner ? null : <Circle cx={20} cy={19.5} r={6} fill={colors.text} />}
      </Svg>
      {inner ? <View style={[styles.inner, { width: size, height: size }]}>{inner}</View> : null}
    </View>
  );
}

// Memoized: destinations change rarely; membersMap churns per accepted tick,
// so this skips re-render unless a dest actually changed or membership did.
// (Members affect pin colors via owner lookup — keyed comparison stays cheap
// at n<=10.)
export const DestinationMarkers = memo(function DestinationMarkers({
  destRoom,
  destByMember,
  members,
}: DestinationMarkersProps) {
  const styles = useStyles();
  const colors = useColors();
  const memberByMemberId = new Map(Object.values(members).map((m) => [m.memberId, m]));
  return (
    <>
      {destRoom && (
        <Marker id="dest-room" lngLat={[destRoom.lng, destRoom.lat]} anchor="bottom">
          <View style={styles.wrap}>
            <View style={styles.label}>
              <Text style={styles.labelKicker}>Heading to</Text>
              <Text style={styles.labelText} numberOfLines={2}>
                {destRoom.label}
              </Text>
            </View>
            <Pin
              size={40}
              color={colors.accent}
              // U+FE0E forces monochrome text presentation cross-platform.
              inner={<Text style={styles.flag}>{"⚑︎"}</Text>}
            />
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
              <Pin
                size={28}
                color={color}
                inner={owner ? <Text style={styles.initial}>{owner.name.slice(0, 1).toUpperCase()}</Text> : undefined}
              />
            </View>
          </Marker>
        );
      })}
    </>
  );
});

const useStyles = makeStyles((colors) => ({
  wrap: { alignItems: "center" },
  inner: { position: "absolute", top: 0, left: 0, alignItems: "center", justifyContent: "center", paddingTop: 1 },
  label: {
    backgroundColor: colors.floating,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
    maxWidth: 200,
    alignItems: "center",
    elevation: 4,
  },
  labelKicker: { color: colors.textDim, fontSize: 10, fontFamily: fontFamily.semiBold, letterSpacing: 0.4 },
  labelText: { color: colors.text, fontSize: 14, lineHeight: 18, fontFamily: fontFamily.semiBold, textAlign: "center" },
  flag: { color: onHue.glyph, fontSize: 15, fontFamily: fontFamily.bold },
  initial: { color: onHue.glyph, fontSize: 12, fontFamily: fontFamily.bold },
}));
