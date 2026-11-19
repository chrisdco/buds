import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, FadeInUp, FadeOutUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { AppSymbol, icons } from "@/components/Symbol";
import { Button } from "@/components/ui";
import { radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { arrivalBody, type ArrivalMoment, type ArrivalViewer } from "@/features/room/arrival";
import { makeStyles, useColors } from "@/theme";

// Same motion language as the toasts (expo-animation recipe): quick ease-out
// in, a touch faster out. Module scope so the builders aren't rebuilt.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ENTER = FadeInUp.duration(320).easing(EASE_OUT);
const EXIT = FadeOutUp.duration(240).easing(EASE_OUT);

// One tick per moment, even if the screen remounts (back from settings).
const ticked = new Set<string>();

/**
 * The arrival moment: "You've arrived" with where you placed, then, once the
 * whole group is in, a nudge to wrap the trip up so nobody keeps sharing
 * their location by accident. One success tick per card.
 */
export function ArrivalCard({
  moment,
  viewer,
  top,
  wrapUp,
  onDismiss,
}: {
  moment: ArrivalMoment;
  viewer: ArrivalViewer;
  top: number;
  /** "End trip" (host) / "Leave" (member); null when there's nothing to do. */
  wrapUp: { label: string; onPress: () => void } | null;
  onDismiss: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();

  useEffect(() => {
    if (ticked.has(moment.key)) return;
    ticked.add(moment.key);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [moment.key]);

  const title = moment.kind === "all" ? "Everyone's here" : "You've arrived";
  const body = arrivalBody(moment, viewer);
  return (
    <Animated.View
      key={moment.key}
      entering={ENTER}
      exiting={EXIT}
      style={[styles.card, { top }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={`arrival-card-${moment.kind}`}
    >
      <View style={styles.row}>
        <View style={styles.badge}>
          <AppSymbol name={icons.check} fallback={icons.check.fallback} size={16} tintColor={colors.onStatus} />
        </View>
        <View style={styles.texts} accessible accessibilityLabel={`${title}. ${body}`}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {body}
          </Text>
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          testID="arrival-dismiss"
        >
          <AppSymbol name={icons.close} fallback={icons.close.fallback} size={18} tintColor={colors.textDim} />
        </Pressable>
      </View>
      {wrapUp && (
        <View style={styles.actions}>
          <Button label={wrapUp.label} size="compact" onPress={wrapUp.onPress} testID="arrival-wrap-up" />
        </View>
      )}
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: colors.floating,
    elevation: 6,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semiBold },
  body: { color: colors.textDim, fontSize: 12, fontFamily: fontFamily.regular, marginTop: 2 },
  close: { padding: 4, borderRadius: radius.full },
  pressed: { opacity: 0.6 },
  actions: { marginTop: 10, alignItems: "flex-start" },
}));
