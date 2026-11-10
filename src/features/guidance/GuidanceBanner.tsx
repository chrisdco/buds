import { Pressable, Text, View } from "react-native";

import { AppSymbol, icons, type AppSymbolName } from "@/components/Symbol";
import { radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { guidanceDistance, stepText, type Guidance } from "@/features/guidance/guidance";
import type { DistanceUnit } from "@/lib/geo";
import { formatDurationS } from "@/lib/time";
import { makeStyles, useColors } from "@/theme";
import type { RouteStep } from "@/types/contracts";

// Guidance chrome, nav-app grammar: a high-contrast maneuver card (arrow,
// distance, instruction) and under it a strip with time left, distance,
// arrival time, "Maps" (hand off for voice) and End.

/** Height of the whole stack, for the camera padding and what stacks below. */
export const GUIDANCE_BANNER_H = 150;

export function maneuverSymbol(step: RouteStep | null): AppSymbolName {
  const mod = step?.modifier ?? "";
  const left = mod.includes("left");
  switch (step?.type) {
    case "arrive":
      return { ios: "flag.checkered", android: "sports_score" };
    case "roundabout":
    case "rotary":
    case "roundabout turn":
    case "exit roundabout":
    case "exit rotary":
      return { ios: "arrow.triangle.turn.up.right.circle", android: "roundabout_right" };
    case "fork":
      return left ? { ios: "arrow.up.left", android: "fork_left" } : { ios: "arrow.up.right", android: "fork_right" };
    case "on ramp":
    case "off ramp":
      return left ? { ios: "arrow.up.left", android: "ramp_left" } : { ios: "arrow.up.right", android: "ramp_right" };
    case "merge":
      return { ios: "arrow.merge", android: "merge" };
  }
  switch (mod) {
    case "uturn":
      return { ios: "arrow.uturn.down", android: left ? "u_turn_left" : "u_turn_right" };
    case "sharp left":
      return { ios: "arrow.turn.up.left", android: "turn_sharp_left" };
    case "left":
      return { ios: "arrow.turn.up.left", android: "turn_left" };
    case "slight left":
      return { ios: "arrow.up.left", android: "turn_slight_left" };
    case "slight right":
      return { ios: "arrow.up.right", android: "turn_slight_right" };
    case "right":
      return { ios: "arrow.turn.up.right", android: "turn_right" };
    case "sharp right":
      return { ios: "arrow.turn.up.right", android: "turn_sharp_right" };
    default:
      return { ios: "arrow.up", android: "straight" };
  }
}

function clock(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function GuidanceBanner({
  top,
  targetLabel,
  g,
  estimate,
  units,
  nowMs,
  onMaps,
  onEnd,
}: {
  top: number;
  targetLabel: string;
  g: Guidance | null;
  /** Straight-line fallback: no road route to follow right now. */
  estimate: boolean;
  units: DistanceUnit;
  nowMs: number;
  onMaps: () => void;
  onEnd: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const step = g?.step ?? null;
  const big = g == null ? "Finding route…" : step && g.toStepM != null ? guidanceDistance(g.toStepM, units) : guidanceDistance(g.remainingM, units);
  const line =
    g == null
      ? `To ${targetLabel}`
      : estimate
        ? `Head toward ${targetLabel} · no road route yet`
        : step
          ? stepText(step)
          : `Head to ${targetLabel}`;

  return (
    <View style={[styles.stack, { top }]} pointerEvents="box-none" testID="guidance-banner">
      <View
        style={styles.card}
        accessible
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        accessibilityLabel={g == null ? `Finding route to ${targetLabel}` : `In ${big}, ${line}`}
      >
        <View style={styles.arrow}>
          <AppSymbol
            name={maneuverSymbol(step)}
            fallback={step?.modifier?.includes("left") ? "↰" : step?.modifier?.includes("right") ? "↱" : "↑"}
            size={36}
            tintColor={colors.onPrimary}
          />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.big} numberOfLines={1}>
            {big}
          </Text>
          <Text style={styles.line} numberOfLines={2}>
            {line}
          </Text>
        </View>
      </View>
      <View style={styles.strip}>
        <View style={styles.stripText}>
          <Text style={styles.time} numberOfLines={1}>
            {g ? formatDurationS(g.remainingS) : "—"}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {g ? `${guidanceDistance(g.remainingM, units)} · ${clock(nowMs + g.remainingS * 1000)}` : targetLabel}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Open in Maps for voice guidance"
          testID="guidance-maps"
          hitSlop={6}
          onPress={onMaps}
        >
          <AppSymbol name={icons.navigate} fallback={icons.navigate.fallback} size={16} tintColor={colors.text} />
          <Text style={styles.pillText}>Maps</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.pill, styles.end, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="End navigation"
          testID="guidance-end"
          hitSlop={6}
          onPress={onEnd}
        >
          <Text style={styles.endText}>End</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  stack: { position: "absolute", left: 12, right: 12, gap: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 8,
  },
  arrow: { width: 40, alignItems: "center" },
  cardText: { flex: 1 },
  big: { color: colors.onPrimary, fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 30 },
  line: { color: colors.onPrimary, fontFamily: fontFamily.medium, fontSize: 15, opacity: 0.9, marginTop: 2 },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.floating,
    borderRadius: radius.lg,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    elevation: 6,
  },
  stripText: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: 8 },
  time: { color: colors.success, fontFamily: fontFamily.bold, fontSize: 17 },
  meta: { color: colors.textDim, fontFamily: fontFamily.medium, fontSize: 13, flexShrink: 1 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 13 },
  end: { backgroundColor: colors.danger },
  endText: { color: colors.onStatus, fontFamily: fontFamily.semiBold, fontSize: 13 },
  pressed: { opacity: 0.75 },
}));
