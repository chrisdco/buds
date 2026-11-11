import { Marker } from "@maplibre/maplibre-react-native";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { PeepAvatar } from "@/components/PeepAvatar";
import { colorForUser, onHue } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { presenceOf } from "@/stores/membersStore";
import type { MemberLive } from "@/types/contracts";
import { makeStyles } from "@/theme";

interface MemberMarkersProps {
  members: MemberLive[];
  nowMs: number;
  /** Self marker gets the Maps-style treatment (accent halo). */
  myUserId?: string | null;
  /** Focused members get a bright ring (subset-focus set). */
  selectedIds?: string[];
  /** Toggles focus membership; omitted = markers not tappable. */
  onToggleFocus?: (userId: string) => void;
  /** Long-press: the member menu ("Only them", navigate, details). */
  onLongPressMember?: (userId: string) => void;
  /** Faces the lens hides: kept on the map, dimmed (route-view 4.1). */
  dimmedIds?: ReadonlySet<string>;
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
  onLongPressMember,
  dimmedIds,
  etaByUser,
}: MemberMarkersProps) {
  const selected = new Set(selectedIds ?? []);
  // Each face is its own memoized marker: a position tick re-renders only
  // the person who moved (the store keeps everyone else's object as-is),
  // not every native marker view on the map.
  return (
    <>
      {members
        .filter((m) => m.pos)
        .map((m) => {
          const isSelected = selected.has(m.userId);
          return (
            <MemberMarker
              key={m.userId}
              m={m}
              state={presenceOf(m, nowMs)}
              isSelf={myUserId != null && m.userId === myUserId}
              isSelected={isSelected}
              dimmed={!isSelected && (dimmedIds?.has(m.userId) ?? false)}
              etaS={etaByUser?.[m.userId]}
              onToggleFocus={onToggleFocus}
              onLongPressMember={onLongPressMember}
            />
          );
        })}
    </>
  );
}

const MemberMarker = memo(function MemberMarker({
  m,
  state,
  isSelf,
  isSelected,
  dimmed,
  etaS,
  onToggleFocus,
  onLongPressMember,
}: {
  m: MemberLive;
  state: ReturnType<typeof presenceOf>;
  isSelf: boolean;
  isSelected: boolean;
  dimmed: boolean;
  etaS: number | undefined;
  onToggleFocus?: (userId: string) => void;
  onLongPressMember?: (userId: string) => void;
}) {
  const styles = useStyles();
  const faded = state === "offline" || state === "reconnecting";
  const color = colorForUser(m.userId);
  const heading = m.pos!.heading;
  const label = isSelf ? "You" : m.name;
  return (
    <Marker id={m.userId} lngLat={[m.pos!.lng, m.pos!.lat]} anchor="center">
      {/* Pressable (not Marker onPress) so a face takes long-press too. */}
      <Pressable
        style={[styles.wrap, faded ? styles.faded : dimmed && styles.dimmed]}
        disabled={!onToggleFocus && !onLongPressMember}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: isSelected }}
        accessibilityHint="Tap to focus their route, long-press for more"
        testID={`marker-${m.userId}`}
        delayLongPress={350}
        onPress={onToggleFocus ? () => onToggleFocus(m.userId) : undefined}
        onLongPress={onLongPressMember ? () => onLongPressMember(m.userId) : undefined}
      >
        <View style={styles.dotArea}>
          {isSelf && <View style={styles.selfHalo} />}
          {/* Heading cone: a wedge riding the ring's edge, rotated
          with the device bearing, only while actually moving. */}
          {heading != null && state === "moving" && (
            <View style={[styles.cone, { transform: [{ rotate: `${Math.round(heading)}deg` }] }]}>
              <View style={[styles.coneTip, { borderBottomColor: color }]} />
            </View>
          )}
          <View style={[styles.dot, { backgroundColor: color }, (isSelf || isSelected) && styles.dotEmphasis]}>
            <Face userId={m.userId} />
          </View>
        </View>
        <View style={styles.pill}>
          <Text style={styles.name} numberOfLines={1}>
            {label}
          </Text>
          {etaS != null && (
            <View style={[styles.eta, { backgroundColor: color }]}>
              <Text style={styles.etaText}>{Math.max(1, Math.round(etaS / 60))} min</Text>
            </View>
          )}
          {faded && <Text style={styles.offline}>{state === "offline" ? "Offline" : "…"}</Text>}
        </View>
      </Pressable>
    </Marker>
  );
});

const useStyles = makeStyles((colors) => ({
  wrap: { alignItems: "center", width: 150 },
  faded: { opacity: 0.5 },
  dimmed: { opacity: 0.6 },
  dotArea: { width: DOT + 16, height: DOT + 16, alignItems: "center", justifyContent: "center" },
  // Self: soft accent halo (Maps blue-dot language) behind the face.
  selfHalo: {
    position: "absolute",
    width: DOT + 16,
    height: DOT + 16,
    borderRadius: (DOT + 16) / 2,
    backgroundColor: colors.accentWash,
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
    backgroundColor: colors.floating,
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
  etaText: { color: onHue.label, fontSize: 11, fontFamily: fontFamily.bold, fontVariant: ["tabular-nums"] },
  offline: { color: colors.textDim, fontSize: 11, fontFamily: fontFamily.medium, paddingRight: 5 },
}));
